// GET /api/sheets/character/:id -> { creature, canEdit, access }
// The server builds the Creature (the one shape every sheet block reads) with the same rules code the tests check.
// canEdit: the owner and the campaign's DM may change the sheet; other players in the campaign only look.
import { characterToCreature } from '@tenebris/rules/creature';
import { checkActRequest, resolveAct } from '@tenebris/rules/actions';
import { rng } from '../dice.js';
import * as Characters from '../models/characterModel.js';
import * as Inventory from '../models/inventoryModel.js';
import { getClassSlots, getLearnedSpells } from '../models/spellModel.js';
import { sheetAccess } from '../models/sheetModel.js';

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
