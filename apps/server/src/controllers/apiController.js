// Character routes (load, hp, delete, equip/unequip and weapon options) as JSON for React. Queries live in models/.
import * as Characters from '../models/characterModel.js';
import * as Inventory from '../models/inventoryModel.js';
import { getLearnedSpells, getClassSlots } from '../models/spellModel.js';
import { checkEquipRequest, checkWeaponToggle, ITEM_SLOTS } from '@tenebris/rules/equipment';
import { editorOf } from './sheetController.js';


// ---------- character sheet ----------

// GET /api/characters/:id
export async function getCharacter(req, res) {
    if (!req.session.userId) return res.status(401).json({ error: 'not logged in.' });

    const character = await Characters.getSheetCharacter(req.params.id, req.session.userId);
    if (!character) return res.status(404).json({ error: 'Character...What character?' });

    const charId = character.id;
    character.spell_slots = await getClassSlots(character.role_id, character.level, character.calling_id);
    const ownedArmor = await Inventory.getOwnedArmor(charId);
    const ownedWeapons = await Inventory.getOwnedWeapons(charId);
    const ownedItems = await Inventory.getOwnedItems(charId);
    const learnedSpells = await getLearnedSpells(charId);
    const actionFeatures = await Characters.getActionFeatures(character.role_id, character.calling_id, character.level, character.species_id);
    res.json({ character, ownedArmor, ownedWeapons, ownedItems, learnedSpells, actionFeatures });
}

// PATCH /api/characters/:id/hp   body: { action: 'heal' | 'damage', amount }
export async function updateHp(req, res) {
    if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });

    const amount = Number(req.body.amount);
    const change = req.body.action === 'heal' ? amount : -amount;
    if (!Number.isInteger(amount) || amount < 0) return res.status(400).json({ error: 'Bad amount' });

    const hp = await Characters.changeHp(req.params.id, req.session.userId, change);
    if (!hp) return res.status(404).json({ error: 'Character not found' });
    res.json(hp);
}

// PATCH /api/characters/:id/temp-hp   body: { amount } (doesn't stack: keeps the higher) or { clear: true }
export async function updateTempHp(req, res) {
    if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });
    const clear = req.body.clear === true;
    const amount = clear ? 0 : Number(req.body.amount);
    if (!Number.isInteger(amount) || amount < 0) return res.status(400).json({ error: 'Bad amount' });

    const row = await Characters.setTempHp(req.params.id, req.session.userId, amount, clear);
    if (!row) return res.status(404).json({ error: 'Character not found' });
    res.json(row);
}

// DELETE /api/characters/:id
export async function deleteCharacter(req, res) {
    if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });

    const rowCount = await Characters.deleteCharacter(req.params.id, req.session.userId);
    if (!rowCount) return res.status(404).json({ error: 'Character not found' });
    res.json({ ok: true });
}

// ---------- equip / unequip and weapon options (the sheet's Gear tab) ----------
// Owner or campaign DM, the same check as the /api/sheets routes. The rules check the body
// (@tenebris/rules/equipment); the models check ownership, slots and class. Each answers the fresh owned list.

// One equip route: who may change the sheet, which item, then the model's answer
const equipRoute = (kind, change) => async (req, res) => {
    const who = await editorOf(req, res);
    if (!who) return;
    const checked = checkEquipRequest(kind, req.body);
    if ('error' in checked) return res.status(400).json({ error: checked.error });
    await change(res, who.charId, checked.id);
};

// POST /api/characters/:id/inventory/armor/equip   body: { armor_id }
// Only one body armor and one shield can be equipped at a time.
export const equipArmor = equipRoute('armor', async (res, charId, armorId) => {
    if (!(await Inventory.equipArmor(charId, armorId))) return res.status(404).json({ error: 'Armor not owned' });
    res.json({ ownedArmor: await Inventory.getOwnedArmor(charId) });
});

// POST /api/characters/:id/inventory/armor/unequip   body: { armor_id }
export const unequipArmor = equipRoute('armor', async (res, charId, armorId) => {
    await Inventory.unequipArmor(charId, armorId);
    res.json({ ownedArmor: await Inventory.getOwnedArmor(charId) });
});

// POST /api/characters/:id/inventory/weapon/equip   body: { weapon_id }
export const equipWeapon = equipRoute('weapon', async (res, charId, weaponId) => {
    if (!(await Inventory.equipWeapon(charId, weaponId))) return res.status(404).json({ error: 'Weapon not owned' });
    res.json({ ownedWeapons: await Inventory.getOwnedWeapons(charId) });
});

// POST /api/characters/:id/inventory/weapon/unequip   body: { weapon_id }
export const unequipWeapon = equipRoute('weapon', async (res, charId, weaponId) => {
    await Inventory.unequipWeapon(charId, weaponId);
    res.json({ ownedWeapons: await Inventory.getOwnedWeapons(charId) });
});

// POST /api/characters/:id/inventory/item/equip   body: { item_id }   magical items only, ITEM_SLOTS at once
export const equipItem = equipRoute('item', async (res, charId, itemId) => {
    const result = await Inventory.equipItem(charId, itemId);
    if (result === 'not_owned') return res.status(404).json({ error: 'Item not owned' });
    if (result === 'not_equippable') return res.status(400).json({ error: 'Only magical items can be equipped' });
    if (result === 'full') return res.status(400).json({ error: `All ${ITEM_SLOTS} item slots are full. Unequip one first.` });
    res.json({ ownedItems: await Inventory.getOwnedItems(charId) });
});

// POST /api/characters/:id/inventory/item/unequip   body: { item_id }
export const unequipItem = equipRoute('item', async (res, charId, itemId) => {
    await Inventory.unequipItem(charId, itemId);
    res.json({ ownedItems: await Inventory.getOwnedItems(charId) });
});

// One weapon option route: body { weapon_id, <flag>: true | false }
const toggleRoute = (toggle, change) => async (req, res) => {
    const who = await editorOf(req, res);
    if (!who) return;
    const checked = checkWeaponToggle(toggle, req.body);
    if ('error' in checked) return res.status(400).json({ error: checked.error });
    const refusal = await change(who.charId, checked.id, checked.on);
    if (refusal) return res.status(refusal.status).json({ error: refusal.error });
    res.json({ ownedWeapons: await Inventory.getOwnedWeapons(who.charId) });
};

// POST /api/characters/:id/inventory/weapon/dual-wield   body: { weapon_id, dual_wield }
export const dualWieldWeapon = toggleRoute('dual-wield', async (charId, weaponId, on) =>
    (await Inventory.setWeaponDualWield(charId, weaponId, on)) ? null : { status: 400, error: 'Only an owned one-handed weapon can be dual wielded' });

// POST /api/characters/:id/inventory/weapon/two-hands   body: { weapon_id, two_handed }
export const twoHandWeapon = toggleRoute('two-hands', async (charId, weaponId, on) =>
    (await Inventory.setWeaponTwoHanded(charId, weaponId, on)) ? null : { status: 400, error: 'Only an owned versatile weapon can be used in two hands' });

// POST /api/characters/:id/inventory/weapon/soul-brand   body: { weapon_id, soul_branded }   Reaver only, one weapon at a time
export const soulBrandWeapon = toggleRoute('soul-brand', async (charId, weaponId, on) => {
    const result = await Inventory.setWeaponSoulBrand(charId, weaponId, on);
    if (result === 'not-reaver') return { status: 403, error: 'Only a Reaver can soul brand a weapon' };
    if (result === 'not-owned') return { status: 404, error: 'Weapon not owned' };
    return null;
});

// POST /api/characters/:id/inventory/weapon/sigil-mark   body: { weapon_id, marked }   Wraith only, one weapon at a time
export const sigilMarkWeapon = toggleRoute('sigil-mark', async (charId, weaponId, on) => {
    const result = await Inventory.setWeaponSigilMark(charId, weaponId, on);
    if (result === 'not-wraith') return { status: 403, error: 'Only a Wraith can place a sigil mark' };
    if (result === 'not-owned') return { status: 404, error: 'Weapon not owned' };
    return null;
});
