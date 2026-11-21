// GET /api/sheets/character/:id -> { creature, canEdit, access }
// The server builds the Creature (the one shape every sheet block reads) with the same rules code the tests check.
// canEdit: the owner and the campaign's DM may change the sheet; other players in the campaign only look.
import { characterToCreature } from '@tenebris/rules/creature';
import { checkActRequest, resolveAct } from '@tenebris/rules/actions';
import { spendFeatureUse, takeRest, checkRestRequest, castSpell, checkCastRequest } from '@tenebris/rules/sheetState';
import { checkSpellbookRequest } from '@tenebris/rules/spellbook';
import { checkMoneyRequest, shortCoinMessage, purseOf } from '@tenebris/rules/money';
import * as Money from '../models/moneyModel.js';
import { rng } from '../dice.js';
import * as Characters from '../models/characterModel.js';
import * as Inventory from '../models/inventoryModel.js';
import { getClassSlots, getLearnedSpells } from '../models/spellModel.js';
import { sheetAccess } from '../models/sheetModel.js';
import { loadSpellbook, changeSpellbook } from './apiSpellController.js';

// Everything the old sheet request returned, read as the owner would see it
export async function loadSheetData(charId, ownerId) {
    const character = await Characters.getSheetCharacter(charId, ownerId);
    if (!character) return null;
    character.spell_slots = await getClassSlots(character.role_id, character.level, character.calling_id);
    return {
        character,
        ownedArmor: await Inventory.getOwnedArmor(charId),
        ownedWeapons: await Inventory.getOwnedWeapons(charId),
        ownedItems: await Inventory.getOwnedItems(charId),
        learnedSpells: await getLearnedSpells(charId),
        actionFeatures: await Characters.getActionFeatures(character.role_id, character.calling_id, character.level, character.species_id),
    };
}

export async function getCharacterSheet(req, res) {
    if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });
    const charId = Number(req.params.id);
    if (!Number.isInteger(charId)) return res.status(404).json({ error: 'Character not found' });

    const { access, ownerId } = await sheetAccess(charId, req.session.userId);
    if (!access) return res.status(404).json({ error: 'Character not found' });

    const data = await loadSheetData(charId, ownerId);
    if (!data) return res.status(404).json({ error: 'Character not found' });
    res.json({ creature: characterToCreature(data), canEdit: access !== 'viewer', access });
}

// POST /api/sheets/character/:id/act   body: { actionKey, kind: 'hit' | 'damage' | 'heal', castLevel?, extra?, featureKey? }
// The browser names the action; the server builds the Creature, finds the action and rolls (rules: @tenebris/rules/actions).
// It also remembers which action last rolled a natural 20, so that action's next damage roll crits.
// Kept in memory: a server restart forgets a pending crit, which is fine for a single roll.
const lastCrit = new Map();   // character id -> action key

export async function act(req, res) {
    if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });
    const charId = Number(req.params.id);
    if (!Number.isInteger(charId)) return res.status(404).json({ error: 'Character not found' });

    const { access, ownerId } = await sheetAccess(charId, req.session.userId);
    if (!access) return res.status(404).json({ error: 'Character not found' });
    if (access === 'viewer') return res.status(403).json({ error: "You can look at this sheet but not roll for it" });

    const checked = checkActRequest(req.body);
    if ('error' in checked) return res.status(400).json({ error: checked.error });

    const data = await loadSheetData(charId, ownerId);
    if (!data) return res.status(404).json({ error: 'Character not found' });

    const result = resolveAct(characterToCreature(data), checked.request, lastCrit.get(charId) ?? null, rng);
    if ('error' in result) return res.status(400).json({ error: result.error });
    // A to-hit sets (or clears) the pending crit; a damage roll uses it up
    if (checked.request.kind === 'hit' || checked.request.kind === 'damage') {
        if (result.critKey) lastCrit.set(charId, result.critKey);
        else lastCrit.delete(charId);
    }
    res.json({ text: result.text });
}

// ---- Changes that save (R5): feature uses, rests, casting, the spell book ----
// Same pattern as /act: the browser names what it wants, the server checks who is asking, builds the Creature,
// lets @tenebris/rules/sheetState decide, saves the result and answers the roll-feed text. Owner and DM may do these.

// Checks the caller may change this sheet. Answers { charId, ownerId } or null after sending 401/403/404.
async function editorOf(req, res) {
    if (!req.session.userId) { res.status(401).json({ error: 'Not logged in' }); return null; }
    const charId = Number(req.params.id);
    if (!Number.isInteger(charId)) { res.status(404).json({ error: 'Character not found' }); return null; }
    const { access, ownerId } = await sheetAccess(charId, req.session.userId);
    if (!access) { res.status(404).json({ error: 'Character not found' }); return null; }
    if (access === 'viewer') { res.status(403).json({ error: "You can look at this sheet but not change it" }); return null; }
    return { charId, ownerId };
}

// The Creature as the server sees it right now, or null after sending 404
async function creatureOf(res, charId, ownerId) {
    const data = await loadSheetData(charId, ownerId);
    if (!data) { res.status(404).json({ error: 'Character not found' }); return null; }
    return characterToCreature(data);
}

// POST /api/sheets/character/:id/feature   body: { featureKey }   e.g. "class-12"
// Spends one per-rest use (if the feature has them) and rolls its dice (if it has any).
export async function useFeature(req, res) {
    const who = await editorOf(req, res);
    if (!who) return;
    const key = req.body?.featureKey;
    if (typeof key !== 'string' || key.length === 0 || key.length > 60) return res.status(400).json({ error: 'Which feature?' });
    const creature = await creatureOf(res, who.charId, who.ownerId);
    if (!creature) return;
    const result = spendFeatureUse(creature, key, rng);
    if ('error' in result) return res.status(400).json({ error: result.error });
    if (result.restUses !== creature.restUses) await Characters.updateSheetState(who.charId, who.ownerId, { rest_uses: result.restUses });
    res.json({ text: result.text });
}

// POST /api/sheets/character/:id/rest   body: { type: 'short' | 'long' }
// Ported from the old sheet's rest(): the server rolls the recovery and saves HP, temp HP, slots, conditions,
// exhaustion and per-rest uses.
export async function rest(req, res) {
    const who = await editorOf(req, res);
    if (!who) return;
    const checked = checkRestRequest(req.body);
    if ('error' in checked) return res.status(400).json({ error: checked.error });
    const creature = await creatureOf(res, who.charId, who.ownerId);
    if (!creature) return;

    const r = takeRest(checked.type, {
        hp: creature.hp,
        usedSlots: creature.spellcasting.usedSlots,
        conditions: creature.conditions,
        exhaustion: creature.exhaustion,
        restUses: creature.restUses,
        features: creature.features,
    }, rng);
    if (r.heal > 0) await Characters.changeHp(who.charId, who.ownerId, r.heal);
    if (r.clearTemp) await Characters.setTempHp(who.charId, who.ownerId, 0, true);
    await Characters.updateSheetState(who.charId, who.ownerId, {
        used_slots: r.usedSlots, conditions: r.conditions, exhaustion: r.exhaustion, rest_uses: r.restUses,
    });
    res.json({ text: r.text, percent: r.percent });
}

// POST /api/sheets/character/:id/cast   body: { actionKey, castLevel? }
// Spends the slot on the server, then rolls the spell. A to-hit natural 20 is remembered like /act.
export async function cast(req, res) {
    const who = await editorOf(req, res);
    if (!who) return;
    const checked = checkCastRequest(req.body);
    if ('error' in checked) return res.status(400).json({ error: checked.error });
    const creature = await creatureOf(res, who.charId, who.ownerId);
    if (!creature) return;

    const result = castSpell(creature, checked.request, rng);
    if ('error' in result) return res.status(400).json({ error: result.error });
    if (result.usedSlots !== creature.spellcasting.usedSlots) await Characters.updateSheetState(who.charId, who.ownerId, { used_slots: result.usedSlots });
    if (result.critKey) lastCrit.set(who.charId, result.critKey);
    else lastCrit.delete(who.charId);
    res.json({ text: result.text });
}

// GET /api/sheets/character/:id/spellbook -> { spells, learnedSpells, learnedIds, spellLimits }
export async function getSpellbook(req, res) {
    const who = await editorOf(req, res);
    if (!who) return;
    const book = await loadSpellbook(who.charId, who.ownerId);
    if (!book) return res.status(404).json({ error: 'Character not found' });
    res.json(book);
}

// POST /api/sheets/character/:id/spellbook   body: { op: 'learn' | 'unlearn' | 'prepare' | 'unprepare' | 'setAction' | 'removeAction', spellId }
// The same rules as the old sheet's spell routes (one shared function).
export async function changeBook(req, res) {
    const who = await editorOf(req, res);
    if (!who) return;
    const checked = checkSpellbookRequest(req.body);
    if ('error' in checked) return res.status(400).json({ error: checked.error });
    const { status, body } = await changeSpellbook(who.charId, who.ownerId, checked.op, checked.spellId);
    res.status(status).json(body);
}

// POST /api/sheets/character/:id/money   body: { action: 'add' | 'spend', copper?, silver?, gold?, crowns?, oracles? }
// Owner or DM. Coins stay separate (no change-making). Answers the five new totals.
// A spend that would take any coin below 0 changes nothing and answers 400, naming the first short coin.
export async function money(req, res) {
    const who = await editorOf(req, res);
    if (!who) return;
    const checked = checkMoneyRequest(req.body);
    if ('error' in checked) return res.status(400).json({ error: checked.error });
    const { action, amounts } = checked.request;
    try {
        const row = action === 'add'
            ? await Money.addMoney(who.charId, who.ownerId, amounts)
            : await Money.spendMoney(who.charId, who.ownerId, amounts);
        if (row) return res.json({ purse: purseOf(row) });
        // Nothing changed: either the character is gone or the purse is short
        const now = await Money.getPurse(who.charId, who.ownerId);
        if (!now) return res.status(404).json({ error: 'Character not found' });
        return res.status(400).json({ error: shortCoinMessage(purseOf(now), amounts) ?? 'Not enough money.' });
    } catch (err) {
        // 23514 = a CHECK constraint (a coin below 0), 22003 = more than an integer column holds
        if (err?.code === '23514') return res.status(400).json({ error: 'Not enough money.' });
        if (err?.code === '22003') return res.status(400).json({ error: 'That is more coins than a purse can hold.' });
        throw err;
    }
}
