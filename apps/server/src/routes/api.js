// JSON routes for the React client. Everything here is mounted at /api in index.js.
import * as Runes from '../controllers/apiRuneController.js';
import { Router } from 'express';
import {
    getCharacter, updateHp, updateTempHp, updateSheetState, deleteCharacter,
    equipArmor, unequipArmor, equipWeapon, unequipWeapon, dualWieldWeapon, twoHandWeapon, soulBrandWeapon, sigilMarkWeapon, equipItem, unequipItem,
} from '../controllers/apiController.js';
import { me, login, logout, register, home, getSettings, updateSettings, getProfile, updateProfile, deleteAccount } from '../controllers/apiUserController.js';
import { getInventory, addArmor, addWeapon, removeArmor, removeWeapon, addItem, removeItem } from '../controllers/apiInventoryController.js';
import { getSpellbook, learnSpell, unlearnSpell, prepareSpell, unprepareSpell, setAction, removeAction } from '../controllers/apiSpellController.js';
import { createCampaign, deleteCampaign, getCampaign, updateCampaign, listCampaigns, joinCampaign, setCampaignCharacter } from '../controllers/apiCampaignController.js';
import { getContent, getSpells } from '../controllers/contentController.js';
import { roll } from '../controllers/apiRollController.js';
import { getCatalog, listCampaignMonsters, addMonster, getMonsterSheet, updateMonster, deleteMonster } from '../controllers/apiMonsterController.js';
import characterFormRouter from './characterForm.js';



import { rateLimit } from 'express-rate-limit';


const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    message: { error: 'Too many attempts. Please try again in 15 minutes.'},
    skip: () => process.env.NODE_ENV !== 'production', // off in local dev so smoke tests can log in freely
});

const router = Router();

// login / account
router.post('/login', loginLimiter, login);
router.post('/register', loginLimiter, register);
router.get('/me', me);
router.post('/roll', roll);
router.use(characterFormRouter);
router.post('/logout', logout);
router.get('/home', home);
router.get('/settings', getSettings);
router.put('/settings', updateSettings);
router.delete('/settings', deleteAccount);
router.get('/profile', getProfile);
router.put('/profile', updateProfile);

// character sheet
router.get('/characters/:id', getCharacter);
router.delete('/characters/:id', deleteCharacter);
router.patch('/characters/:id/hp', updateHp);
router.patch('/characters/:id/temp-hp', updateTempHp);
router.patch('/characters/:id/state', updateSheetState);
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

// inventory page (add / remove items)
router.get('/characters/:id/inventory', getInventory);
router.post('/characters/:id/inventory/armor', addArmor);
router.post('/characters/:id/inventory/weapon', addWeapon);
router.post('/characters/:id/inventory/armor/remove', removeArmor);
router.post('/characters/:id/inventory/weapon/remove', removeWeapon);
router.post('/characters/:id/inventory/item', addItem);
router.post('/characters/:id/inventory/item/remove', removeItem);

// spell book (learn / unlearn spells)
router.get('/characters/:id/spellbook', getSpellbook);
router.post('/characters/:id/spells/learn', learnSpell);
router.post('/characters/:id/spells/unlearn', unlearnSpell);
router.post('/characters/:id/spells/prepare', prepareSpell);
router.post('/characters/:id/spells/unprepare', unprepareSpell);
router.post('/characters/:id/spells/setAction', setAction);
router.post('/characters/:id/spells/removeAction', removeAction);

// campaign creation and deletion
router.get('/campaigns', listCampaigns);
router.post('/campaigns', createCampaign);
router.post('/campaigns/join', joinCampaign);
router.get('/campaigns/:id', getCampaign);
router.patch('/campaigns/:id', updateCampaign);
router.delete('/campaigns/:id', deleteCampaign);
router.put('/campaigns/:id/character', setCampaignCharacter);

// game content (rulebook files)
router.get('/content', getContent);
router.get('/content/spells', getSpells);

// monster management
router.get('/monsters', getCatalog);
router.get('/campaigns/:id/monsters', listCampaignMonsters);
router.post('/campaigns/:id/monsters', addMonster);
router.get('/campaign_monsters/:id', getMonsterSheet);
router.put('/campaign_monsters/:id', updateMonster);
router.delete('/campaign_monsters/:id', deleteMonster);


// If any route above crashes, answer with JSON instead of an HTML error page.
// eslint-disable-next-line no-unused-vars
router.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong on the server' });
});

export default router;
