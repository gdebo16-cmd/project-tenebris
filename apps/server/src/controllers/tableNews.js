// What the table shows about each token, and telling everyone at the table when it changes (steps 14 and 16).
// Used by the scene controller (moves, paints) and by the sheet controllers (damage, healing, conditions), so a hit on
// a sheet shows on the token at once. Kept apart from sceneController so the sheet controllers can use it without
// importing each other.
import { monsterToCreature, healthWord } from '@tenebris/rules/monster';
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

// Send a scene's terrain and tokens to everyone in its campaign's room ('table')
export async function tellTable(io, campId, scene) {
    if (!io || !scene) return;
    const tokens = (await Scenes.listTokens(scene.id)).map(tokenView);
    io.to(`campaign:${campId}`).emit('table', { sceneId: scene.id, terrain: scene.terrain, tokens });
}

// A character's or monster's HP or conditions changed: update every table it stands on
export async function tellTablesAbout(req, { characterId, campaignMonsterId }) {
    const io = req.app.get('io');
    if (!io) return;
    for (const scene of await Scenes.scenesWith({ characterId, campaignMonsterId })) {
        await tellTable(io, scene.campaign_id, scene);
    }
}
