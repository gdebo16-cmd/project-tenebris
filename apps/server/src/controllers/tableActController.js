// Step 17: actions on the table. The browser names a token, one of its actions, and a target token or an area; the
// server checks who's asking, loads the sheets, and lets @tenebris/rules/combat decide everything: range, sight, the
// rolls, the saves, the damage, the spell slot. Then it saves the HP changes, tells the table's feed what happened
// ('table-feed') and sends everyone the new table (the tokens' HP, and any spell area left on the board).
import { checkTableAct, resolveTableAct, actChoices, outcomeLine } from '@tenebris/rules/combat';
import { areaHexes } from '@tenebris/rules/sight';
import { wallsOf, hexKey } from '@tenebris/rules/board';
import { characterToCreature } from '@tenebris/rules/creature';
import { applyMonsterHp } from '@tenebris/rules/monster';
import * as Scenes from '../models/sceneModel.js';
import * as Monsters from '../models/monsterModel.js';
import * as Characters from '../models/characterModel.js';
import { loadSheetData } from './sheetController.js';
import { creatureOfRow } from './apiMonsterController.js';
import { tokenView, tellTable, visionOf } from './tableNews.js';
import { rng } from '../dice.js';

// A token's sheet as a Creature: a character's or a monster's. Summons have no sheet yet (null).
async function creatureOfToken(row) {
    if (row.kind === 'character' && row.character_id && row.owner_id) {
        const data = await loadSheetData(row.character_id, row.owner_id);
        return data ? characterToCreature(data) : null;
    }
    if (row.kind === 'monster' && row.campaign_monster_id) {
        const m = await Monsters.getOne(row.campaign_monster_id);
        return m ? creatureOfRow(m) : null;
    }
    return null;
}

// Who may act for this token: its owner (a player's own character), or the DM (anyone, monsters included).
// Answers { token, isDm, creature } or null after sending an error.
async function actorOf(req, res) {
    if (!req.session.userId) { res.status(401).json({ error: 'Not logged in' }); return null; }
    const token = await Scenes.getToken(Number(req.params.id));
    const role = token ? await Monsters.memberRole(token.campaign_id, req.session.userId) : null;
    if (!token || !role) { res.status(404).json({ error: 'Token not found' }); return null; }
    const isDm = role === 'dm';
    if (!isDm && token.owner_id !== req.session.userId) { res.status(403).json({ error: "That token isn't yours" }); return null; }
    const creature = await creatureOfToken(token);
    if (!creature) { res.status(400).json({ error: `${tokenView(token).name} has no sheet to act from` }); return null; }
    return { token, isDm, creature };
}

// GET /api/tokens/:id/actions -> { tokenId, name, choices, slots, usedSlots }   what the Act menu offers
export async function getActions(req, res) {
    const who = await actorOf(req, res);
    if (!who) return;
    const c = who.creature;
    res.json({ tokenId: who.token.id, name: c.name, choices: actChoices(c), slots: c.spellcasting.slots, usedSlots: c.spellcasting.usedSlots });
}

// POST /api/tokens/:id/act  body { actionKey, castLevel?, target?: tokenId, area?: { kind, at, sizeFt }, keepTurns? }
// -> the feed entry as this person may see it
export async function act(req, res) {
    const who = await actorOf(req, res);
    if (!who) return;
    const checked = checkTableAct(req.body);
    if ('error' in checked) return res.status(400).json({ error: checked.error });
    const request = checked.request;

    const scene = await Scenes.getScene(who.token.scene_id);
    const rows = await Scenes.listTokens(scene.id);
    const me = { q: who.token.q, r: who.token.r };

    // Load the sheets the action may touch: the one target, or everyone inside the area (one at a time, in order)
    const inArea = request.area ? new Set(areaHexes(request.area, me).map(hexKey)) : null;
    const needs = (r) => (request.target != null ? r.id === request.target : inArea.has(hexKey(r)));
    const everyone = [];
    for (const r of rows) {
        const creature = r.id === who.token.id ? who.creature : needs(r) ? await creatureOfToken(r) : null;
        everyone.push({ tokenId: r.id, hex: { q: r.q, r: r.r }, name: tokenView(r).name, creature });
    }
    const actor = everyone.find((p) => p.tokenId === who.token.id);

    const result = resolveTableAct(actor, request, everyone, wallsOf(scene.terrain ?? {}, scene.features ?? {}), rng);
    if ('error' in result) return res.status(400).json({ error: result.error });

    // ---- save what happened ----
    if (result.usedSlots && who.token.kind === 'character') {
        await Characters.updateSheetState(who.token.character_id, who.token.owner_id, { used_slots: result.usedSlots });
    }
    for (const o of result.outcomes) {
        if (o.damage === 0 && o.heal === 0) continue;
        const row = rows.find((r) => r.id === o.tokenId);
        const target = everyone.find((p) => p.tokenId === o.tokenId).creature;
        if (row.kind === 'character') {
            await Characters.changeHp(row.character_id, row.owner_id, o.heal - o.damage);    // temporary HP first, healing up to max
        } else if (row.kind === 'monster') {
            const now = { current_hp: target.hp.current, temp_hp: target.hp.temp };
            const change = o.heal > 0 ? { action: 'heal', amount: o.heal } : { action: 'damage', amount: o.damage };
            await Monsters.saveState(row.campaign_monster_id, applyMonsterHp(now, target.hp.max, change));
        }
    }
    // an area the caster leaves on the board, counted down over their turns
    if (request.area && request.keepTurns > 0) {
        await Scenes.addOverlay(scene.id, { name: result.actionName, ownerId: req.session.userId,
            shape: { area: request.area, from: me }, turnsLeft: request.keepTurns, countsTokenId: who.token.id });
    }

    // ---- tell the table ----
    const vision = await visionOf(scene, rows);
    const id = `act-${Date.now()}-${who.token.id}`;
    const forDm = feedEntry(id, result, who.token, actor.name, rows, vision, true);
    const forPlayers = feedEntry(id, result, who.token, actor.name, rows, vision, false);
    const io = req.app.get('io');
    const room = `campaign:${who.token.campaign_id}`;
    io?.to(`${room}:dm`).emit('table-feed', forDm);
    io?.to(room).except(`${room}:dm`).emit('table-feed', forPlayers);
    res.json(who.isDm ? forDm : forPlayers);
    await tellTable(io, who.token.campaign_id, await Scenes.getScene(scene.id));
}

// One entry for the table's feed. The DM sees every number. Players see their own rolls but never a monster's
// (its to-hit and its saves would give away its bonuses), and with the fog on, nothing about what the party can't see.
function feedEntry(id, result, actorRow, actorName, rows, vision, dm) {
    const seen = (row) => dm || !vision || vision.visible.has(hexKey(row));
    const isMonster = (tokenId) => rows.find((r) => r.id === tokenId)?.kind === 'monster';
    const outcomes = result.outcomes.filter((o) => seen(rows.find((r) => r.id === o.tokenId)));
    const numbers = (o) => dm || (actorRow.kind !== 'monster' && !((o.result === 'saved' || o.result === 'failed') && isMonster(o.tokenId)));
    const actorSeen = seen(actorRow);
    const level = result.castLevel ? ` (level ${result.castLevel})` : '';
    return {
        id, at: Date.now(),
        title: `${actorSeen ? actorName : 'Something unseen'} uses ${result.actionName}${level}`,
        lines: outcomes.length ? outcomes.map((o) => outcomeLine(o, numbers(o))) : [result.area ? 'Nobody in the area' : 'No effect'],
        area: result.area ? result.area.map(hexKey).filter((key) => dm || !vision || vision.visible.has(key)) : null,
        outcomes: outcomes.map(({ tokenId, result: r, damage, heal }) => ({ tokenId, result: r, damage, heal })),
        actorTokenId: actorSeen ? actorRow.id : null,
    };
}
