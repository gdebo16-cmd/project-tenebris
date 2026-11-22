// Monsters: the catalog, and the monsters a DM adds to a campaign. (campaign_monsters has no table yet: R5.6.)
import { Router } from 'express';
import { getCatalog, listCampaignMonsters, addMonster, getMonsterSheet, updateMonster, deleteMonster } from '../controllers/apiMonsterController.js';

const router = Router();

router.get('/monsters', getCatalog);
router.get('/campaigns/:id/monsters', listCampaignMonsters);
router.post('/campaigns/:id/monsters', addMonster);
router.get('/campaign_monsters/:id', getMonsterSheet);
router.put('/campaign_monsters/:id', updateMonster);
router.delete('/campaign_monsters/:id', deleteMonster);

export default router;
