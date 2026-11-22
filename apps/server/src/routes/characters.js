// One character: loading and deleting it, equipping gear, and runes. (The form is characterForm.js, the sheet sheets.js.)
import { Router } from 'express';
import {
    getCharacter, deleteCharacter,
    equipArmor, unequipArmor, equipWeapon, unequipWeapon, dualWieldWeapon, twoHandWeapon, soulBrandWeapon, sigilMarkWeapon, equipItem, unequipItem,
} from '../controllers/apiController.js';
import * as Runes from '../controllers/apiRuneController.js';

const router = Router();

router.get('/characters/:id', getCharacter);
router.delete('/characters/:id', deleteCharacter);

router.post('/characters/:id/inventory/armor/equip', equipArmor);
router.post('/characters/:id/inventory/armor/unequip', unequipArmor);
router.post('/characters/:id/inventory/weapon/equip', equipWeapon);
router.post('/characters/:id/inventory/weapon/unequip', unequipWeapon);
router.post('/characters/:id/inventory/weapon/dual-wield', dualWieldWeapon);
router.post('/characters/:id/inventory/weapon/two-hands', twoHandWeapon);
router.post('/characters/:id/inventory/weapon/soul-brand', soulBrandWeapon);
router.post('/characters/:id/inventory/weapon/sigil-mark', sigilMarkWeapon);
router.post('/characters/:id/inventory/item/equip', equipItem);
router.post('/characters/:id/inventory/item/unequip', unequipItem);

router.get('/characters/:id/runes', Runes.getRunes);
router.post('/characters/:id/runes/inscribe', Runes.inscribe);
router.post('/characters/:id/runes/remove', Runes.remove);
router.post('/characters/:id/runes/runed-weapon', Runes.runedWeapon);

export default router;
