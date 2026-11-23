// The table's scenes (steps 12–13): load the active scene, paint terrain, place / move / remove tokens.
// The server decides everything (hard rule): painting, placing and removing are DM only; moving is the token's
// owner or the DM, and a move must have a path around walls (findPath from @tenebris/rules/hex).
// Spec: docs/specs/table.md.
import { isTerrainKind, findPath, wallsOf, hexKey, hexesForSpeed } from '@tenebris/rules/hex';
import { characterToCreature } from '@tenebris/rules/creature';
import * as Scenes from '../models/sceneModel.js';
import * as Monsters from '../models/monsterModel.js';   // for memberRole(campId, userId)
import { getMonster } from '../models/monsterPack.js';
import { tokenView, tellTable as sendTable } from './tableNews.js';
import { loadSheetData } from './sheetController.js';
import { creatureOfRow } from './apiMonsterController.js';

const TAKEN = '23505';                // the database's "unique" error: one token per hex
const DM_MAX_STEPS = 200;              // the DM isn't held to a speed, but the path search still needs a limit
const SUMMON_SPEED_FT = 30;            // summons have no sheet yet: 30 ft (6 hexes)

const isWholeNumber = (n) => Number.isInteger(n);

// Answers the person's role in the campaign ('dm' | 'player'), or null after sending 401/404
async function roleIn(req, res, campId) {
    if (!req.session.userId) { res.status(401).json({ error: 'Not logged in' }); return null; }
    const role = Number.isInteger(campId) ? await Monsters.memberRole(campId, req.session.userId) : null;
    if (!role) { res.status(404).json({ error: 'Campaign not found' }); return null; }
    return role;
}

// Step 14: tell everyone at the table what changed, so their boards update without a reload (tableNews.js).
const tellTable = (req, campId, scene) => sendTable(req.app.get('io'), campId, scene);

// The scene answer: the scene, its tokens, who's asking; for the DM also what they can place
async function sceneAnswer(campId, role, userId, scene) {
    const answer = { scene, isDm: role === 'dm', userId, tokens: [] };
    if (scene) answer.tokens = (await Scenes.listTokens(scene.id)).map(tokenView);
    if (role === 'dm') {
        const party = await Scenes.partyForTable(campId);
        const monsters = await Monsters.listForCampaign(campId);
        answer.placeable = {
            party: party.map((p) => ({ characterId: p.character_id, name: p.name, ownerId: p.user_id, username: p.username })),
            monsters: monsters.map((m) => ({ id: m.id, name: m.nickname ?? getMonster(m.monster_id)?.name ?? 'Monster' })),
        };
    }
    return answer;
}

// GET /api/campaigns/:id/scene -> { scene, isDm, userId, tokens, placeable? }
export async function getActiveScene(req, res) {
    const campId = Number(req.params.id);
    const role = await roleIn(req, res, campId);
    if (!role) return;

    let scene = await Scenes.activeScene(campId);
    if (!scene && role === 'dm') {
        scene = await Scenes.createActiveScene(campId, 'Scene 1');
        req.app.get('io')?.to(`campaign:${campId}`).emit('table-opened', { sceneId: scene.id });
    }
    res.json(await sceneAnswer(campId, role, req.session.userId, scene));
}

// POST /api/scenes/:id/paint  body { q, r, terrain }  -> the scene's terrain
export async function paint(req, res) {
    if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });
    const scene = await Scenes.getScene(Number(req.params.id));
    if (!scene) return res.status(404).json({ error: 'Scene not found' });
    const role = await Monsters.memberRole(scene.campaign_id, req.session.userId);
    if (role !== 'dm') return res.status(403).json({ error: 'You are not the DM' });

    const { q, r, terrain } = req.body;
    if (!Number.isInteger(q) || !Number.isInteger(r)) return res.status(400).json({ error: 'q and r must be whole numbers' });
    if (terrain !== null && !isTerrainKind(terrain)) return res.status(400).json({ error: 'Invalid terrain' });

    const key = `${q},${r}`;
    if (terrain === null) delete scene.terrain[key];   // erase back to open ground
    else scene.terrain[key] = terrain;
    await Scenes.saveTerrain(scene.id, scene.terrain);
    res.json(scene.terrain);
    await tellTable(req, scene.campaign_id, scene);
}

// POST /api/scenes/:id/tokens  body { kind, characterId?, campaignMonsterId?, name?, ownerId?, q, r }  -> the scene answer
// token.place: DM only. A character's token belongs to its player; a monster's to the DM (no owner);
// a summon gets the owner the DM picks (or none).
export async function placeToken(req, res) {
    if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });
    const scene = await Scenes.getScene(Number(req.params.id));
    if (!scene) return res.status(404).json({ error: 'Scene not found' });
    const role = await Monsters.memberRole(scene.campaign_id, req.session.userId);
    if (role !== 'dm') return res.status(403).json({ error: 'Only the DM can place tokens' });

    const { kind, characterId, campaignMonsterId, name, ownerId, q, r } = req.body ?? {};
    if (!isWholeNumber(q) || !isWholeNumber(r)) return res.status(400).json({ error: 'q and r must be whole numbers' });
    if (wallsOf(scene.terrain).has(hexKey({ q, r }))) return res.status(400).json({ error: "A token can't stand in a wall" });

    let token;
    if (kind === 'character') {
        const member = (await Scenes.partyForTable(scene.campaign_id)).find((p) => p.character_id === characterId);
        if (!member) return res.status(400).json({ error: "That character isn't in this campaign" });
        token = { kind, characterId, ownerId: member.user_id };
    } else if (kind === 'monster') {
        const monster = isWholeNumber(campaignMonsterId) ? await Monsters.getOne(campaignMonsterId) : null;
        if (!monster || monster.campaign_id !== scene.campaign_id) return res.status(400).json({ error: "That monster isn't in this campaign" });
        token = { kind, campaignMonsterId, ownerId: null };
    } else if (kind === 'summon') {
        const cleanName = typeof name === 'string' ? name.trim().slice(0, 60) : '';
        if (!cleanName) return res.status(400).json({ error: 'A summon needs a name' });
        if (ownerId != null && !(isWholeNumber(ownerId) && await Monsters.memberRole(scene.campaign_id, ownerId))) {
            return res.status(400).json({ error: "The owner isn't in this campaign" });
        }
        token = { kind, name: cleanName, ownerId: ownerId ?? null };
    } else {
        return res.status(400).json({ error: 'kind must be character, monster or summon' });
    }

    // A character or monster stands in one place: refuse a second token for the same one on this scene
    const existing = await Scenes.listTokens(scene.id);
    if ((token.characterId && existing.some((t) => t.character_id === token.characterId))
        || (token.campaignMonsterId && existing.some((t) => t.campaign_monster_id === token.campaignMonsterId))) {
        return res.status(409).json({ error: 'That one is already on the table' });
    }

    try {
        await Scenes.addToken(scene.id, { ...token, q, r });
    } catch (err) {
        if (err.code === TAKEN) return res.status(409).json({ error: 'Another token is already on that hex' });
        throw err;
    }
    res.json(await sceneAnswer(scene.campaign_id, role, req.session.userId, scene));
    await tellTable(req, scene.campaign_id, scene);
}

// How many hexes a token may walk in one move: its speed (feet) / 5
async function speedInHexes(token) {
    if (token.kind === 'character' && token.character_id && token.owner_id) {
        const data = await loadSheetData(token.character_id, token.owner_id);
        return data ? hexesForSpeed(characterToCreature(data).speedFt) : 0;
    }
    if (token.kind === 'monster' && token.campaign_monster_id) {
        const row = await Monsters.getOne(token.campaign_monster_id);
        const creature = row ? creatureOfRow(row) : null;
        return creature ? hexesForSpeed(creature.speedFt) : 0;
    }
    return hexesForSpeed(SUMMON_SPEED_FT);
}

// POST /api/tokens/:id/move  body { q, r }  -> the scene answer
// token.move: the token's owner, or the DM. The walk must go around walls (findPath); a player can walk as far
// as the token's speed, the DM as far as they like. Ending on another token is refused (one per hex).
export async function moveToken(req, res) {
    if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });
    const token = await Scenes.getToken(Number(req.params.id));
    if (!token) return res.status(404).json({ error: 'Token not found' });
    const role = await Monsters.memberRole(token.campaign_id, req.session.userId);
    if (!role) return res.status(404).json({ error: 'Token not found' });
    const isDm = role === 'dm';
    if (!isDm && token.owner_id !== req.session.userId) return res.status(403).json({ error: "That token isn't yours" });

    const { q, r } = req.body ?? {};
    if (!isWholeNumber(q) || !isWholeNumber(r)) return res.status(400).json({ error: 'q and r must be whole numbers' });

    const walls = wallsOf(token.terrain);
    if (walls.has(hexKey({ q, r }))) return res.status(400).json({ error: "A token can't stand in a wall" });
    const maxSteps = isDm ? DM_MAX_STEPS : await speedInHexes(token);
    const path = findPath({ q: token.q, r: token.r }, { q, r }, walls, maxSteps);
    if (!path) {
        return res.status(400).json({
            error: isDm ? 'No way around the walls to that hex' : `No way there within ${maxSteps} hexes (walls block the way, or it's too far)`,
        });
    }

    try {
        await Scenes.moveToken(token.id, q, r);
    } catch (err) {
        if (err.code === TAKEN) return res.status(409).json({ error: 'Another token is already on that hex' });
        throw err;
    }
    const scene = await Scenes.getScene(token.scene_id);
    res.json(await sceneAnswer(token.campaign_id, role, req.session.userId, scene));
    await tellTable(req, token.campaign_id, scene);
}

// DELETE /api/tokens/:id  -> the scene answer.  token.remove: DM only.
export async function removeToken(req, res) {
    if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });
    const token = await Scenes.getToken(Number(req.params.id));
    if (!token) return res.status(404).json({ error: 'Token not found' });
    const role = await Monsters.memberRole(token.campaign_id, req.session.userId);
    if (role !== 'dm') return res.status(403).json({ error: 'Only the DM can remove tokens' });
    await Scenes.removeToken(token.id);
    const scene = await Scenes.getScene(token.scene_id);
    res.json(await sceneAnswer(token.campaign_id, role, req.session.userId, scene));
    await tellTable(req, token.campaign_id, scene);
}
