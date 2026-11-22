// The inventory page: what a character owns, and adding or removing armor, weapons and items.
import { Router } from 'express';
import { getInventory, addArmor, addWeapon, removeArmor, removeWeapon, addItem, removeItem } from '../controllers/apiInventoryController.js';

const router = Router();

router.get('/characters/:id/inventory', getInventory);
router.post('/characters/:id/inventory/armor', addArmor);
router.post('/characters/:id/inventory/weapon', addWeapon);
router.post('/characters/:id/inventory/armor/remove', removeArmor);
router.post('/characters/:id/inventory/weapon/remove', removeWeapon);
router.post('/characters/:id/inventory/item', addItem);
router.post('/characters/:id/inventory/item/remove', removeItem);

export default router;
