// The DM page (R5.7): one screen for a campaign. Party (every player's character), Encounter (the campaign's
// monsters), turn order, private notes. DM only. HP and conditions change through the sheets' own routes
// (/api/sheets/character/:id/… and /api/sheets/monster/:id/…), which already let the DM do it.
import { characterToCreature } from '@tenebris/rules/creature';
import { healthWord, checkNotes } from '@tenebris/rules/monster';
import { checkInitiativeRequest, rollInitiative, nextTurn, initiativeOf } from '@tenebris/rules/initiative';
import * as Dm from '../models/dmModel.js';
import * as Monsters from '../models/monsterModel.js';
import { loadSheetData } from './sheetController.js';
import { creatureOfRow, monsterSummary } from './apiMonsterController.js';
import { rng } from '../dice.js';
import { tellTurns, endOfTurn } from './tableNews.js';

// Answers the campaign id, or null after sending 401/403/404
async function dmOf(req, res) {
    if (!req.session.userId) { res.status(401).json({ error: 'Not logged in' }); return null; }
    const campId = Number(req.params.id);
    const role = Number.isInteger(campId) ? await Monsters.memberRole(campId, req.session.userId) : null;
    if (!role) { res.status(404).json({ error: 'Campaign not found' }); return null; }
    if (role !== 'dm') { res.status(403).json({ error: 'Only the DM can open the DM page' }); return null; }
    return campId;
}

// Every player's character and every monster, as Creatures
async function creaturesOf(campId) {
    const members = await Dm.partyOf(campId);
    const party = [];
    for (const m of members) {
        const data = await loadSheetData(m.character_id, m.user_id);
        if (data) party.push({ username: m.username, creature: characterToCreature(data) });
    }
    const monsters = (await Monsters.listForCampaign(campId)).map(creatureOfRow).filter(Boolean);
    return { party, monsters };
}

const onConditions = (c) => Object.entries(c.conditions).filter(([, on]) => on).map(([name]) => name);

// GET /api/campaigns/:id/dm -> { campaign, party, encounter, initiative, notes }
export async function getDmPage(req, res) {
    const campId = await dmOf(req, res);
    if (campId == null) return;
    const state = await Dm.getDmState(campId);
    const { party, monsters } = await creaturesOf(campId);
    res.json({
        campaign: { id: state.id, name: state.name },
        party: party.map(({ username, creature: c }) => ({
            id: c.id, name: c.name, username, portrait: c.portrait, role: c.role, level: c.level,
            hp: c.hp, armor: c.armorClass.value, initiative: c.initiative,
            health: healthWord(c.hp.current, c.hp.max), conditions: onConditions(c),
        })),
        encounter: monsters.map(monsterSummary),
        initiative: initiativeOf(state.initiative),
        notes: state.dm_notes ?? '',
    });
}

// POST /api/campaigns/:id/initiative   body: { op: 'roll' | 'next' | 'clear' }
// roll: the server rolls d20 + initiative for every character and monster and sorts them.
export async function initiative(req, res) {
    const campId = await dmOf(req, res);
    if (campId == null) return;
    const checked = checkInitiativeRequest(req.body);
    if ('error' in checked) return res.status(400).json({ error: checked.error });

    let next = null;
    if (checked.op === 'roll') {
        const { party, monsters } = await creaturesOf(campId);
        const combatants = [
            ...party.map(({ creature: c }) => ({ kind: 'character', id: c.id, name: c.name, bonus: c.initiative })),
            ...monsters.map((c) => ({ kind: 'monster', id: c.id, name: c.name, bonus: c.initiative })),
        ];
        if (combatants.length === 0) return res.status(400).json({ error: 'Nobody to roll initiative for yet' });
        next = rollInitiative(combatants, rng);
    } else if (checked.op === 'next') {
        const now = initiativeOf((await Dm.getDmState(campId)).initiative);
        if (!now) return res.status(400).json({ error: 'Roll initiative first' });
        next = nextTurn(now);
        await endOfTurn(req.app.get('io'), campId, now.order[now.turn]);     // overlays counting that creature's turns go down by one
    }
    const saved = await Dm.saveInitiative(campId, next);
    res.json({ initiative: initiativeOf(saved.initiative) });
    tellTurns(req.app.get('io'), campId, saved.initiative);     // the table's portrait bar and spotlight follow along
}

// PUT /api/campaigns/:id/dm-notes   body: { notes }
export async function notes(req, res) {
    const campId = await dmOf(req, res);
    if (campId == null) return;
    const checked = checkNotes(req.body);
    if ('error' in checked) return res.status(400).json({ error: checked.error });
    const saved = await Dm.saveNotes(campId, checked.notes);
    res.json({ notes: saved.dm_notes });
}
