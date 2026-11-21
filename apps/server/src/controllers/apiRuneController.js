// Rune Weaver rune routes (Inscribe Runes). Owner or campaign DM, the same check as the /api/sheets routes.
// The rules check the body (@tenebris/rules/equipment); models/runeModel.js enforces item types, prerequisites and limits.
import * as Inventory from '../models/inventoryModel.js';
import * as Runes from '../models/runeModel.js';
import { checkRuneRequest } from '@tenebris/rules/equipment';
import { editorOf } from './sheetController.js';

// after a change, send everything the sheet needs to redraw
const fresh = async (charId) => ({
    runeInfo: await Runes.getRuneInfo(charId),
    ownedWeapons: await Inventory.getOwnedWeapons(charId),
    ownedArmor: await Inventory.getOwnedArmor(charId),
});

// GET /api/characters/:id/runes
export async function getRunes(req, res) {
    const who = await editorOf(req, res); if (!who) return;
    res.json(await Runes.getRuneInfo(who.charId));
}

// One rune route: who may change the sheet, the checked body, then the model's answer
const runeRoute = (op, change) => async (req, res) => {
    const who = await editorOf(req, res); if (!who) return;
    const checked = checkRuneRequest(op, req.body);
    if ('error' in checked) return res.status(400).json({ error: checked.error });
    const r = await change(who.charId, checked.request);
    if (r.error) return res.status(r.status).json({ error: r.error });
    res.json({ ...(await fresh(who.charId)), ...(r.endedOldest ? { endedOldest: r.endedOldest } : {}) });
};

// POST /api/characters/:id/runes/inscribe   body: { kind: 'weapon'|'armor', item_id, rune_id, choice_value? }
// endedOldest: the name of the rune that ended because the active limit was reached
export const inscribe = runeRoute('inscribe', (charId, q) =>
    Runes.inscribeRune(charId, { kind: q.kind, itemId: q.itemId, runeId: q.runeId, choiceValue: q.choiceValue }));

// POST /api/characters/:id/runes/remove   body: { item_rune_id }
export const remove = runeRoute('remove', (charId, q) => Runes.removeRune(charId, q.itemRuneId));

// POST /api/characters/:id/runes/runed-weapon   body: { weapon_id | null }
export const runedWeapon = runeRoute('runed-weapon', (charId, q) => Runes.setRunedWeapon(charId, q.weaponId));
