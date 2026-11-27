// The table's scenes (steps 12–13): load the active scene, paint terrain, place / move / remove tokens.
// The server decides everything (hard rule): painting, placing and removing are DM only; moving is the token's
// owner or the DM, and a move must have a path around walls (findPath from @tenebris/rules/hex).
// Spec: docs/specs/table.md.
import { isTerrainKind, isSurface, isFeatureKind, LIGHT_FEATURES, MAX_LIGHTS, MAX_HEIGHT, checkLookChange, applyLookChange, radiusOf, keepOnBoard, findWalk, wallsOf, hexKey, hexesForSpeed, onBoard } from '@tenebris/rules/board';
import { characterToCreature } from '@tenebris/rules/creature';
import * as Scenes from '../models/sceneModel.js';
import * as Monsters from '../models/monsterModel.js';   // for memberRole(campId, userId)
import { getMonster } from '../models/monsterPack.js';
import { tokenView, tellTable as sendTable, turnsView, visionOf, tableView, overlayView } from './tableNews.js';
import { checkArea } from '@tenebris/rules/sight';
import * as Dm from '../models/dmModel.js';
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
    const answer = { scene: null, isDm: role === 'dm', userId, tokens: [], overlays: [], fog: null, turns: turnsView((await Dm.getDmState(campId))?.initiative) };
    if (scene) {
        // the table as this person may see it (the fog leaves out what the party hasn't seen: tableView)
        const rows = await Scenes.listTokens(scene.id);
        const view = tableView(scene, rows, await Scenes.listOverlays(scene.id), await visionOf(scene, rows), role === 'dm');
        answer.scene = { id: scene.id, name: scene.name, terrain: view.terrain, surfaces: view.surfaces, features: view.features, look: view.look };
        answer.tokens = view.tokens;
        answer.overlays = view.overlays;
        answer.fog = view.fog;
    }
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

// POST /api/scenes/:id/paint  body: the hexes, then ONE brush  -> { terrain, surfaces, features, look }
//   hexes: [{ q, r }, ...] (a whole drag stroke, up to MAX_STROKE), or a single q, r
//   brush: { terrain } the rules (wall, water...) | { surface } the look (grass, cobble...) | { feature } a tree, a light...
//          | { height } raised ground 0..3 | { clear: true } everything on those hexes goes. null erases that one brush.
// The whole stroke is checked first, then saved once and sent to the table once.
const MAX_STROKE = 1000;
export async function paint(req, res) {
    if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });
    const scene = await Scenes.getScene(Number(req.params.id));
    if (!scene) return res.status(404).json({ error: 'Scene not found' });
    const role = await Monsters.memberRole(scene.campaign_id, req.session.userId);
    if (role !== 'dm') return res.status(403).json({ error: 'You are not the DM' });

    // which hexes
    const list = Array.isArray(req.body?.hexes) ? req.body.hexes : [{ q: req.body?.q, r: req.body?.r }];
    if (list.length === 0 || list.length > MAX_STROKE) return res.status(400).json({ error: `Paint 1 to ${MAX_STROKE} hexes at a time` });
    for (const h of list) {
        if (!Number.isInteger(h?.q) || !Number.isInteger(h?.r)) return res.status(400).json({ error: 'q and r must be whole numbers' });
        if (!onBoard(h, radiusOf(scene.look))) return res.status(400).json({ error: "That hex isn't on the board" });
    }
    const keys = [...new Set(list.map(hexKey))];
    const body = req.body;

    if (body.clear === true) {                            // the eraser: everything on these hexes
        const heights = { ...(scene.look.heights ?? {}) };
        for (const key of keys) { delete scene.terrain[key]; delete scene.surfaces[key]; delete scene.features[key]; delete heights[key]; }
        scene.look = { ...scene.look, heights };
        await Scenes.saveTerrain(scene.id, scene.terrain);
        await Scenes.saveSurfaces(scene.id, scene.surfaces);
        await Scenes.saveFeatures(scene.id, scene.features);
        await Scenes.saveLook(scene.id, scene.look);
    } else if ('height' in body) {                        // raised ground (looks only for now)
        const height = body.height;
        if (!Number.isInteger(height) || height < 0 || height > MAX_HEIGHT) return res.status(400).json({ error: `height must be 0 to ${MAX_HEIGHT}` });
        const heights = { ...(scene.look.heights ?? {}) };
        for (const key of keys) { if (height === 0) delete heights[key]; else heights[key] = height; }
        scene.look = { ...scene.look, heights };
        await Scenes.saveLook(scene.id, scene.look);
    } else if ('feature' in body) {                       // something placed on the hex
        const { feature } = body;
        if (feature === null) for (const key of keys) delete scene.features[key];
        else {
            if (!isFeatureKind(feature?.kind)) return res.status(400).json({ error: 'Invalid feature' });
            const size = feature.size === undefined ? 1 : Number(feature.size);
            if (!(size >= 0.5 && size <= 2)) return res.status(400).json({ error: 'size must be from 0.5 to 2' });
            const color = feature.color;
            if (color !== undefined && !/^#[0-9a-f]{6}$/i.test(color)) return res.status(400).json({ error: 'color must look like #ffcc88' });
            // lights are real lights: keep a scene to a handful (counting the ones this stroke would add)
            if (LIGHT_FEATURES.includes(feature.kind)) {
                const others = Object.entries(scene.features).filter(([k, f]) => !keys.includes(k) && LIGHT_FEATURES.includes(f.kind)).length;
                if (others + keys.length > MAX_LIGHTS) return res.status(400).json({ error: `At most ${MAX_LIGHTS} lights in a scene` });
            }
            for (const key of keys) scene.features[key] = { kind: feature.kind, size, ...(color ? { color } : {}) };
        }
        await Scenes.saveFeatures(scene.id, scene.features);
    } else if ('surface' in body) {                       // the look
        const { surface } = body;
        if (surface !== null && !isSurface(surface)) return res.status(400).json({ error: 'Invalid surface' });
        for (const key of keys) { if (surface === null) delete scene.surfaces[key]; else scene.surfaces[key] = surface; }
        await Scenes.saveSurfaces(scene.id, scene.surfaces);
    } else if ('terrain' in body) {                       // the rules
        const { terrain } = body;
        if (terrain !== null && !isTerrainKind(terrain)) return res.status(400).json({ error: 'Invalid terrain' });
        for (const key of keys) { if (terrain === null) delete scene.terrain[key]; else scene.terrain[key] = terrain; }
        await Scenes.saveTerrain(scene.id, scene.terrain);
    } else {
        return res.status(400).json({ error: 'Pick a brush: terrain, surface, feature, height or clear' });
    }
    res.json({ terrain: scene.terrain, surfaces: scene.surfaces, features: scene.features, look: scene.look });
    await tellTable(req, scene.campaign_id, scene);
}

// POST /api/scenes/:id/clear  (DM) -> { terrain, surfaces, features, look }
// Start the map over: terrain, ground, everything placed, raised ground, shapes and what the fog remembers all go.
// Tokens stay where they are, and the scene's mood, weather, room and map picture are kept.
export async function clearMap(req, res) {
    if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });
    const scene = await Scenes.getScene(Number(req.params.id));
    if (!scene) return res.status(404).json({ error: 'Scene not found' });
    if (await Monsters.memberRole(scene.campaign_id, req.session.userId) !== 'dm') return res.status(403).json({ error: 'You are not the DM' });
    scene.terrain = {}; scene.surfaces = {}; scene.features = {};
    scene.look = { ...scene.look, heights: {} };
    scene.explored = {};
    await Scenes.saveTerrain(scene.id, {});
    await Scenes.saveSurfaces(scene.id, {});
    await Scenes.saveFeatures(scene.id, {});
    await Scenes.saveLook(scene.id, scene.look);
    await Scenes.saveExplored(scene.id, {});
    await Scenes.removeAllOverlays(scene.id);
    res.json({ terrain: scene.terrain, surfaces: scene.surfaces, features: scene.features, look: scene.look });
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
    if (!onBoard({ q, r }, radiusOf(scene.look))) return res.status(400).json({ error: "That hex isn't on the board" });
    if (wallsOf(scene.terrain, scene.features).has(hexKey({ q, r }))) return res.status(400).json({ error: "A token can't stand there (a wall, tree, boulder or pillar)" });

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
// token.move: the token's owner, or the DM. The walk must go around walls and objects that block, and pays for the
// ground on the way (findWalk, T0: rough +1, steep and short props +2, deep water costs double without a swim speed);
// a player can walk as far as the token's speed, the DM as far as they like. Ending on another token is refused (one per hex).
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
    if (!onBoard({ q, r }, radiusOf(token.look))) return res.status(400).json({ error: "That hex isn't on the board" });

    const walls = wallsOf(token.terrain, token.features);
    if (walls.has(hexKey({ q, r }))) return res.status(400).json({ error: "A token can't stand there (a wall, tree, boulder or pillar)" });
    const maxSteps = isDm ? DM_MAX_STEPS : await speedInHexes(token);
    const board = { terrain: token.terrain, features: token.features, heights: token.look?.heights };
    const walk = findWalk({ q: token.q, r: token.r }, { q, r }, board, maxSteps, { radius: radiusOf(token.look) });
    if (!walk) {
        return res.status(400).json({
            error: isDm ? 'No way around the walls to that hex'
                : `No way there with ${maxSteps} hexes of movement (walls block the way, rough ground, climbing and water cost extra, or it's too far)`,
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

// PUT /api/scenes/:id/look  body: any of { mood, weather, room, map }  -> the scene's look
// The DM sets the scene's mood, weather, the room around the table and a map picture (checkLookChange in rules/hex).
export async function setLook(req, res) {
    if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });
    const scene = await Scenes.getScene(Number(req.params.id));
    if (!scene) return res.status(404).json({ error: 'Scene not found' });
    const role = await Monsters.memberRole(scene.campaign_id, req.session.userId);
    if (role !== 'dm') return res.status(403).json({ error: 'You are not the DM' });
    const checked = checkLookChange(req.body);
    if ('error' in checked) return res.status(400).json({ error: checked.error });
    // a new size: nothing may be left outside it (tokens must be moved first; painted hexes beyond it are dropped)
    if ('radius' in checked.change && checked.change.radius !== radiusOf(scene.look)) {
        const radius = checked.change.radius;
        const tokens = await Scenes.listTokens(scene.id);
        if (tokens.some((t) => !onBoard({ q: t.q, r: t.r }, radius))) return res.status(400).json({ error: 'Move the tokens inside the smaller board first' });
        scene.terrain = keepOnBoard(scene.terrain, radius);
        scene.surfaces = keepOnBoard(scene.surfaces, radius);
        scene.features = keepOnBoard(scene.features, radius);
        scene.explored = keepOnBoard(scene.explored, radius);
        scene.look = { ...scene.look, heights: keepOnBoard(scene.look?.heights, radius) };
        await Scenes.saveTerrain(scene.id, scene.terrain);
        await Scenes.saveSurfaces(scene.id, scene.surfaces);
        await Scenes.saveFeatures(scene.id, scene.features);
        await Scenes.saveExplored(scene.id, scene.explored);
    }
    scene.look = applyLookChange(scene.look, checked.change);      // a style switch (T1) changes only look.style
    await Scenes.saveLook(scene.id, scene.look);
    res.json(scene.look);
    await tellTable(req, scene.campaign_id, scene);
}

// POST /api/scenes/:id/fog/reset  (DM) -> 204. Forget what the party has seen: the whole map goes dark again.
export async function resetFog(req, res) {
    if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });
    const scene = await Scenes.getScene(Number(req.params.id));
    if (!scene) return res.status(404).json({ error: 'Scene not found' });
    if (await Monsters.memberRole(scene.campaign_id, req.session.userId) !== 'dm') return res.status(403).json({ error: 'You are not the DM' });
    scene.explored = {};
    await Scenes.saveExplored(scene.id, {});
    res.status(204).end();
    await tellTable(req, scene.campaign_id, scene);
}

// ---- Overlays (spec: Overlays) ----

const MAX_OVERLAY_TURNS = 100;

// POST /api/scenes/:id/overlays  body { name?, area: { kind, at, sizeFt }, from?: { q, r }, turns?, countsTokenId? }
// overlay.add: anyone at the table. turns: count it down over that many of a creature's turns (a player's: their own
// character's; the DM picks whose). No turns = it stays until someone removes it.
export async function addOverlay(req, res) {
    if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });
    const scene = await Scenes.getScene(Number(req.params.id));
    if (!scene) return res.status(404).json({ error: 'Scene not found' });
    const role = await Monsters.memberRole(scene.campaign_id, req.session.userId);
    if (!role) return res.status(404).json({ error: 'Scene not found' });

    const checked = checkArea(req.body?.area);
    if ('error' in checked) return res.status(400).json({ error: checked.error });
    const from = req.body?.from;
    if (from != null && !(isWholeNumber(from.q) && isWholeNumber(from.r))) return res.status(400).json({ error: 'from must be a hex (q and r)' });
    const name = (typeof req.body?.name === 'string' ? req.body.name.trim() : '').slice(0, 40) || checked.area.kind[0].toUpperCase() + checked.area.kind.slice(1);
    const turns = req.body?.turns == null ? null : Number(req.body.turns);
    if (turns !== null && !(isWholeNumber(turns) && turns >= 1 && turns <= MAX_OVERLAY_TURNS)) return res.status(400).json({ error: `turns must be 1 to ${MAX_OVERLAY_TURNS}` });

    // whose turns count it down: the DM may pick any token; a player's counts their own character's turns
    const rows = await Scenes.listTokens(scene.id);
    let countsTokenId = null;
    if (turns !== null) {
        if (role === 'dm') countsTokenId = rows.some((r) => r.id === req.body?.countsTokenId) ? req.body.countsTokenId : null;
        else countsTokenId = rows.find((r) => r.kind === 'character' && r.owner_id === req.session.userId)?.id ?? null;
    }
    await Scenes.addOverlay(scene.id, { name, ownerId: req.session.userId, shape: { area: checked.area, from: from ?? checked.area.at }, turnsLeft: turns, countsTokenId });
    res.status(201).json({ overlays: (await Scenes.listOverlays(scene.id)).map(overlayView) });
    await tellTable(req, scene.campaign_id, scene);
}

// DELETE /api/overlays/:id  overlay.remove: whoever placed it, or the DM. The DM removing someone else's tells the feed.
export async function removeOverlay(req, res) {
    if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });
    const overlay = await Scenes.getOverlay(Number(req.params.id));
    if (!overlay) return res.status(404).json({ error: 'Overlay not found' });
    const role = await Monsters.memberRole(overlay.campaign_id, req.session.userId);
    if (!role) return res.status(404).json({ error: 'Overlay not found' });
    const mine = overlay.owner_id === req.session.userId;
    if (!mine && role !== 'dm') return res.status(403).json({ error: 'Only whoever placed it, or the DM, can remove it' });
    await Scenes.removeOverlay(overlay.id);
    res.status(204).end();
    if (!mine) {
        const note = { id: `note-${Date.now()}`, at: Date.now(), title: `DM removed ${overlay.name}`, lines: [], area: null, outcomes: [], actorTokenId: null };
        req.app.get('io')?.to(`campaign:${overlay.campaign_id}`).emit('table-feed', note);
    }
    await tellTable(req, overlay.campaign_id, await Scenes.getScene(overlay.scene_id));
}

// ---- The board library (map editor, DM only) and the live board (play session) ----

const MAX_BOARD_NAME = 60;
const boardName = (raw) => (typeof raw === 'string' ? raw.trim().slice(0, MAX_BOARD_NAME) : '');

// GET /api/campaigns/:id/scenes -> { scenes: [{ id, name, isActive, tokenCount }] }  (everyone: the session's selector)
export async function listBoards(req, res) {
    const campId = Number(req.params.id);
    if (!await roleIn(req, res, campId)) return;
    const rows = await Scenes.listScenes(campId);
    res.json({ scenes: rows.map((s) => ({ id: s.id, name: s.name, isActive: !!s.is_active, tokenCount: s.token_count })) });
}

// POST /api/campaigns/:id/scenes  body { name, copyFrom? } -> { id, name }   a new board (DM); it isn't live until chosen
export async function createBoard(req, res) {
    const campId = Number(req.params.id);
    const role = await roleIn(req, res, campId);
    if (!role) return;
    if (role !== 'dm') return res.status(403).json({ error: 'You are not the DM' });
    const name = boardName(req.body?.name);
    if (!name) return res.status(400).json({ error: 'Give the board a name' });
    const copyFrom = req.body?.copyFrom == null ? null : Number(req.body.copyFrom);
    if (copyFrom !== null && !Number.isInteger(copyFrom)) return res.status(400).json({ error: 'copyFrom must be a board id' });
    const made = await Scenes.createScene(campId, name, copyFrom);
    if (!made) return res.status(404).json({ error: 'Board to copy not found' });
    if (!await Scenes.activeSceneId(campId)) await Scenes.setActiveScene(campId, made.id);   // the first board is live at once
    res.status(201).json(made);
}

// A board and the DM check, for the routes below
async function dmBoard(req, res) {
    if (!req.session.userId) { res.status(401).json({ error: 'Not logged in' }); return null; }
    const scene = await Scenes.getScene(Number(req.params.id));
    if (!scene) { res.status(404).json({ error: 'Board not found' }); return null; }
    if (await Monsters.memberRole(scene.campaign_id, req.session.userId) !== 'dm') { res.status(403).json({ error: 'You are not the DM' }); return null; }
    return scene;
}

// GET /api/scenes/:id/edit -> the scene answer for that board, whether or not it's live (the map editor)
export async function editBoard(req, res) {
    const scene = await dmBoard(req, res);
    if (!scene) return;
    res.json({ ...(await sceneAnswer(scene.campaign_id, 'dm', req.session.userId, scene)), isLive: await Scenes.activeSceneId(scene.campaign_id) === scene.id });
}

// PATCH /api/scenes/:id  body { name } -> 204   rename a board
export async function renameBoard(req, res) {
    const scene = await dmBoard(req, res);
    if (!scene) return;
    const name = boardName(req.body?.name);
    if (!name) return res.status(400).json({ error: 'Give the board a name' });
    await Scenes.renameScene(scene.id, name);
    res.status(204).end();
}

// DELETE /api/scenes/:id -> 204   delete a board, with its tokens and shapes. The live board can't be deleted.
export async function deleteBoard(req, res) {
    const scene = await dmBoard(req, res);
    if (!scene) return;
    if (await Scenes.activeSceneId(scene.campaign_id) === scene.id) return res.status(400).json({ error: 'That board is being played: switch to another one first' });
    await Scenes.deleteScene(scene.id);
    res.status(204).end();
}

// PUT /api/campaigns/:id/active-scene  body { sceneId } -> 204   the DM switches the table to another board.
// Everyone's session loads the new board ('table-switch').
export async function setLiveBoard(req, res) {
    const campId = Number(req.params.id);
    const role = await roleIn(req, res, campId);
    if (!role) return;
    if (role !== 'dm') return res.status(403).json({ error: 'You are not the DM' });
    const scene = await Scenes.getScene(Number(req.body?.sceneId));
    if (!scene || scene.campaign_id !== campId) return res.status(404).json({ error: 'Board not found' });
    await Scenes.setActiveScene(campId, scene.id);
    res.status(204).end();
    req.app.get('io')?.to(`campaign:${campId}`).emit('table-switch', { campaignId: campId, sceneId: scene.id });
}
