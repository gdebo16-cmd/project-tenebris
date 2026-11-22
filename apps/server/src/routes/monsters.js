// Monsters (R5.6): the catalog, the monsters a DM adds to a campaign, and the monster sheet.
import { Router } from 'express';
import { getCatalog, listCampaignMonsters, addMonster, getMonsterSheet, act, hp, tempHp, conditions, notes, deleteMonster } from '../controllers/apiMonsterController.js';

const router = Router();

router.get('/monsters', getCatalog);
router.get('/campaigns/:id/monsters', listCampaignMonsters);
router.post('/campaigns/:id/monsters', addMonster);
router.get('/sheets/monster/:id', getMonsterSheet);
router.post('/sheets/monster/:id/act', act);
router.post('/sheets/monster/:id/hp', hp);
router.post('/sheets/monster/:id/temp-hp', tempHp);
router.post('/sheets/monster/:id/conditions', conditions);
router.put('/sheets/monster/:id/notes', notes);
router.delete('/sheets/monster/:id', deleteMonster);

export default router;
