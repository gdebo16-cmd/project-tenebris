// What the table shows about each token, and telling everyone at the table when it changes (steps 14 and 16).
// Used by the scene controller (moves, paints) and by the sheet controllers (damage, healing, conditions), so a hit on
// a sheet shows on the token at once. Kept apart from sceneController so the sheet controllers can use it without
// importing each other.
import { monsterToCreature, healthWord } from '@tenebris/rules/monster';
import { initiativeOf } from '@tenebris/rules/initiative';
import { wallsOf, hexKey, BOARD_RADIUS, onBoard as hexOnBoard } from '@tenebris/rules/board';
import { visibleFrom, areaHexes } from '@tenebris/rules/sight';
import * as Scenes from '../models/sceneModel.js';
import { getMonster } from '../models/monsterPack.js';

const onConditions = (conditions) => Object.entries(conditions ?? {}).filter(([, on]) => on).map(([name]) => name);

// What the board needs about one token. Everyone at the table gets the same picture, so a monster shows only its
// health word (the sheet rule: players never see a monster's exact HP); characters show their HP like on the party list.
export function tokenView(row) {
    const pack = row.monster_row ? getMonster(row.monster_row.monster_id) : null;
    const view = {
        id: row.id,
        kind: row.kind,
        q: row.q,
        r: row.r,
        ownerId: row.owner_id,
        name: row.name ?? row.character_name ?? row.monster_row?.nickname ?? pack?.name ?? 'Token',
        portrait: row.character_portrait ?? null,
        characterId: row.character_id ?? null,        // which creature this is, to match the turn order
        monsterId: row.campaign_monster_id ?? null,
        hp: null,
        health: null,
        conditions: [],
    };
    if (row.kind === 'character' && row.character_max_hp != null) {
        view.hp = { current: Number(row.character_hp), max: Number(row.character_max_hp), temp: Number(row.character_temp_hp ?? 0) };
        view.health = healthWord(view.hp.current, view.hp.max);
        view.conditions = onConditions(row.character_conditions);
    } else if (row.kind === 'monster' && pack) {
        const creature = monsterToCreature(pack, row.monster_row);
        view.health = healthWord(creature.hp.current, creature.hp.max);
        view.conditions = onConditions(creature.conditions);
    }
    return view;
}

// ---- the fog (step 18) ----
// The party's eyes: the players' characters, and summons a player owns. With the fog on, players only get what those
// eyes can see now (tokens) and what they have ever seen (terrain, ground, features): the server leaves the rest out,
// so nothing hidden ever reaches a player's browser. The DM always gets everything.
const SIGHT_RADIUS = BOARD_RADIUS * 2;     // hexes: the whole board, corner to corner (light and darkvision come later)
const isEye = (row) => row.kind === 'character' || (row.kind === 'summon' && row.owner_id != null);

// What the party sees now and has seen so far, or null when the scene's fog is off. Saves "seen so far" when it grows.
export async function visionOf(scene, rows) {
    if (!scene?.look?.fog) return null;
    const blockers = wallsOf(scene.terrain ?? {}, scene.features ?? {});
    const onBoard = (key) => { const [q, r] = key.split(',').map(Number); return hexOnBoard({ q, r }); };   // nothing beyond the board is tracked
    const visible = new Set([...visibleFrom(rows.filter(isEye).map((r) => ({ q: r.q, r: r.r })), blockers, SIGHT_RADIUS)].filter(onBoard));
    const explored = new Set(Object.keys(scene.explored ?? {}));
    let grew = false;
    for (const key of visible) if (!explored.has(key)) { explored.add(key); grew = true; }
    if (grew) {
        scene.explored = Object.fromEntries([...explored].map((key) => [key, 1]));
        await Scenes.saveExplored(scene.id, scene.explored);
    }
    return { visible, explored };
}

const overlayKeys = (o) => areaHexes(o.shape.area, o.shape.from ?? o.shape.area.at).map(hexKey);

export function overlayView(o) {
    return { id: o.id, name: o.name, ownerId: o.owner_id, area: o.shape.area, from: o.shape.from ?? null,
        turnsLeft: o.turns_left, countsTokenId: o.counts_token_id };
}

// The table as one viewer sees it. dm: everything. A player with the fog on: only what the party has seen.
export function tableView(scene, rows, overlays, vision, dm) {
    const fog = vision ? { visible: [...vision.visible], explored: [...vision.explored] } : null;
    const full = {
        sceneId: scene.id, terrain: scene.terrain ?? {}, surfaces: scene.surfaces ?? {}, features: scene.features ?? {},
        look: scene.look ?? {}, tokens: rows.map(tokenView), overlays: overlays.map(overlayView), fog,
    };
    if (!vision || dm) return full;
    const known = (map) => Object.fromEntries(Object.entries(map ?? {}).filter(([key]) => vision.explored.has(key)));
    return {
        ...full,
        terrain: known(scene.terrain), surfaces: known(scene.surfaces), features: known(scene.features),
        look: { ...scene.look, heights: known(scene.look?.heights) },
        tokens: rows.filter((r) => isEye(r) || vision.visible.has(hexKey(r))).map(tokenView),
        overlays: overlays.filter((o) => overlayKeys(o).some((key) => vision.explored.has(key))).map(overlayView),
    };
}

// Send the table to everyone in the campaign ('table'): the DM's room gets everything, everyone else the players' view
export async function tellTable(io, campId, scene) {
    if (!io || !scene) return;
    if (await Scenes.activeSceneId(campId) !== scene.id) return;     // a board in the editor that nobody is playing on
    const rows = await Scenes.listTokens(scene.id);
    const overlays = await Scenes.listOverlays(scene.id);
    const vision = await visionOf(scene, rows);
    const room = `campaign:${campId}`;
    io.to(`${room}:dm`).emit('table', tableView(scene, rows, overlays, vision, true));
    io.to(room).except(`${room}:dm`).emit('table', tableView(scene, rows, overlays, vision, false));
}

// A creature's turn just ended: count down the overlays that count its turns (step 17, spec: Overlays)
export async function endOfTurn(io, campId, ended) {
    if (!ended) return;
    const scene = await Scenes.activeScene(campId);
    if (!scene) return;
    const rows = await Scenes.listTokens(scene.id);
    const mine = rows.filter((r) => (ended.kind === 'character' ? r.character_id === ended.id : r.campaign_monster_id === ended.id));
    const changed = await Scenes.tickOverlays(mine.map((r) => r.id));
    if (changed.includes(scene.id)) await tellTable(io, campId, { ...scene, campaign_id: campId });
}

// A character's or monster's HP or conditions changed: update every table it stands on
export async function tellTablesAbout(req, { characterId, campaignMonsterId }) {
    const io = req.app.get('io');
    if (!io) return;
    for (const scene of await Scenes.scenesWith({ characterId, campaignMonsterId })) {
        await tellTable(io, scene.campaign_id, scene);
    }
}

// The turn order as the table shows it (to everyone): who, in what order, whose turn, which round. No rolls or bonuses.
export function turnsView(raw) {
    const state = initiativeOf(raw);
    if (!state) return null;
    return { round: state.round, turn: state.turn, order: state.order.map(({ kind, id, name }) => ({ kind, id, name })) };
}

// The DM rolled, moved on or ended the fight: tell every board in the campaign ('turns')
export function tellTurns(io, campId, raw) {
    io?.to(`campaign:${campId}`).emit('turns', { campaignId: campId, turns: turnsView(raw) });
}
