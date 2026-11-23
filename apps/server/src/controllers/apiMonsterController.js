// Monsters (R5.6): the catalog, the monsters in a campaign, and the monster sheet.
// The DM sees and changes everything. Other members of the campaign get a glimpse: name, type,
// a health word and its conditions (rules: @tenebris/rules/monster). Only the server rolls.
import { monsterToCreature, monsterGlimpse, applyMonsterHp, applyMonsterTempHp, checkAddMonster, checkNotes, healthWord } from '@tenebris/rules/monster';
import { checkActRequest, resolveAct } from '@tenebris/rules/actions';
import { checkHpRequest, checkTempHpRequest } from '@tenebris/rules/health';
import { checkConditionsRequest, applyConditions } from '@tenebris/rules/sheetState';
import * as Monsters from '../models/monsterModel.js';
import { getMonster, listMonsters } from '../models/monsterPack.js';
import { rng } from '../dice.js';
import { tellTablesAbout } from './tableNews.js';

const notLoggedIn = (res) => res.status(401).json({ error: 'Not logged in' });

// A campaign_monsters row as a Creature, or null if its pack monster is gone
export function creatureOfRow(row) {
    const pack = getMonster(row.monster_id);
    return pack ? monsterToCreature(pack, row) : null;
}

// What the DM's lists show of one monster
export function monsterSummary(creature) {
    return {
        id: creature.id,
        name: creature.name,
        monsterName: creature.monster.packName,
        portrait: creature.portrait,
        hp: creature.hp,
        armor: creature.armorClass.value,
        initiative: creature.initiative,
        health: healthWord(creature.hp.current, creature.hp.max),
        conditions: Object.entries(creature.conditions).filter(([, on]) => on).map(([name]) => name),
    };
}

// GET /api/monsters -> short catalog for the "Add monster" picker
export function getCatalog(req, res) {
    if (!req.session.userId) return notLoggedIn(res);
    res.json(listMonsters());
}

// GET /api/campaigns/:id/monsters -> the DM gets summaries; other members get glimpses
export async function listCampaignMonsters(req, res) {
    if (!req.session.userId) return notLoggedIn(res);
    const role = await Monsters.memberRole(req.params.id, req.session.userId);
    if (!role) return res.status(404).json({ error: 'Campaign not found' });
    const creatures = (await Monsters.listForCampaign(req.params.id)).map(creatureOfRow).filter(Boolean);
    res.json(creatures.map(role === 'dm' ? monsterSummary : monsterGlimpse));
}

// POST /api/campaigns/:id/monsters   body: { monster_id, nickname? }   (DM)
export async function addMonster(req, res) {
    if (!req.session.userId) return notLoggedIn(res);
    if (!(await Monsters.isDm(req.params.id, req.session.userId))) return res.status(403).json({ error: 'Only the DM can add monsters' });
    const checked = checkAddMonster(req.body);
    if ('error' in checked) return res.status(400).json({ error: checked.error });
    const pack = getMonster(checked.monsterId);
    if (!pack) return res.status(400).json({ error: 'Unknown monster' });
    const row = await Monsters.add(req.params.id, pack.id, checked.nickname, pack.max_hp);
    res.status(201).json(monsterSummary(monsterToCreature(pack, row)));
}

// Who is asking about this monster: answers { row, role } or null after sending 401/404
async function access(req, res) {
    if (!req.session.userId) { notLoggedIn(res); return null; }
    const id = Number(req.params.id);
    const row = Number.isInteger(id) ? await Monsters.getOne(id) : null;
    const role = row ? await Monsters.memberRole(row.campaign_id, req.session.userId) : null;
    if (!row || !role) { res.status(404).json({ error: 'Monster not found' }); return null; }
    return { row, role };
}

// Like access(), but only the DM may go on (403 for players)
async function dmOnly(req, res) {
    const who = await access(req, res);
    if (!who) return null;
    if (who.role !== 'dm') { res.status(403).json({ error: 'Only the DM can do that' }); return null; }
    const creature = creatureOfRow(who.row);
    if (!creature) { res.status(404).json({ error: 'That monster is no longer in the content pack' }); return null; }
    return { row: who.row, creature };
}

// GET /api/sheets/monster/:id -> DM: { creature, canEdit: true, access: 'dm' }; members: { glimpse, canEdit: false, access: 'viewer' }
export async function getMonsterSheet(req, res) {
    const who = await access(req, res);
    if (!who) return;
    const creature = creatureOfRow(who.row);
    if (!creature) return res.status(404).json({ error: 'That monster is no longer in the content pack' });
    if (who.role === 'dm') return res.json({ creature, canEdit: true, access: 'dm' });
    res.json({ glimpse: monsterGlimpse(creature), canEdit: false, access: 'viewer' });
}

// POST /api/sheets/monster/:id/act   body: { actionKey, kind }   (DM)
// Same rules as a character's /act. The roll goes to the campaign's DM room only, so players don't see monster numbers.
const lastCrit = new Map();   // campaign_monsters id -> action key

export async function act(req, res) {
    const who = await dmOnly(req, res);
    if (!who) return;
    const checked = checkActRequest(req.body);
    if ('error' in checked) return res.status(400).json({ error: checked.error });
    const result = resolveAct(who.creature, checked.request, lastCrit.get(who.row.id) ?? null, rng);
    if ('error' in result) return res.status(400).json({ error: result.error });
    if (checked.request.kind === 'hit' || checked.request.kind === 'damage') {
        if (result.critKey) lastCrit.set(who.row.id, result.critKey);
        else lastCrit.delete(who.row.id);
    }
    const action = [...who.creature.actions, ...who.creature.bonusActions].find((a) => a.key === checked.request.actionKey);
    const text = action ? `${action.name}: ${result.text}` : result.text;
    req.app.get('io')?.to(`campaign:${who.row.campaign_id}:dm`).emit('roll', {
        monsterId: who.row.id, name: who.creature.name, label: text, at: Date.now(),
    });
    res.json({ text });
}

// POST /api/sheets/monster/:id/hp   body: { action: 'heal' | 'damage', amount }   (DM)
export async function hp(req, res) {
    const who = await dmOnly(req, res);
    if (!who) return;
    const checked = checkHpRequest(req.body);
    if ('error' in checked) return res.status(400).json({ error: checked.error });
    const next = applyMonsterHp({ current_hp: who.creature.hp.current, temp_hp: who.creature.hp.temp }, who.creature.hp.max, checked.request);
    const row = await Monsters.saveState(who.row.id, next);
    res.json({ current_hp: row.current_hp, temp_hp: row.temp_hp });
    await tellTablesAbout(req, { campaignMonsterId: who.row.id });     // step 16: the token shows it at once
}

// POST /api/sheets/monster/:id/temp-hp   body: { amount } or { clear: true }   (DM)
export async function tempHp(req, res) {
    const who = await dmOnly(req, res);
    if (!who) return;
    const checked = checkTempHpRequest(req.body);
    if ('error' in checked) return res.status(400).json({ error: checked.error });
    const row = await Monsters.saveState(who.row.id, applyMonsterTempHp({ current_hp: who.creature.hp.current, temp_hp: who.creature.hp.temp }, checked.request));
    res.json({ temp_hp: row.temp_hp });
    await tellTablesAbout(req, { campaignMonsterId: who.row.id });
}

// POST /api/sheets/monster/:id/conditions   body: { conditions?, exhaustion? }   (DM)
export async function conditions(req, res) {
    const who = await dmOnly(req, res);
    if (!who) return;
    const checked = checkConditionsRequest(req.body);
    if ('error' in checked) return res.status(400).json({ error: checked.error });
    const next = applyConditions({ conditions: who.creature.conditions, exhaustion: who.creature.exhaustion }, checked.request);
    const row = await Monsters.saveState(who.row.id, next);
    res.json({ conditions: row.conditions ?? {}, exhaustion: Number(row.exhaustion ?? 0) });
    await tellTablesAbout(req, { campaignMonsterId: who.row.id });
}

// PUT /api/sheets/monster/:id/notes   body: { notes }   (DM)
export async function notes(req, res) {
    const who = await dmOnly(req, res);
    if (!who) return;
    const checked = checkNotes(req.body);
    if ('error' in checked) return res.status(400).json({ error: checked.error });
    const row = await Monsters.saveState(who.row.id, { notes: checked.notes });
    res.json({ notes: row.notes });
}

// DELETE /api/sheets/monster/:id   (DM)
export async function deleteMonster(req, res) {
    const who = await access(req, res);
    if (!who) return;
    if (who.role !== 'dm') return res.status(403).json({ error: 'Only the DM can remove monsters' });
    await Monsters.remove(who.row.id);
    lastCrit.delete(who.row.id);
    res.json({ ok: true });
}
