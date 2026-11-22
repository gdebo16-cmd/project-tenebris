// The DM page (R5.7): party, encounter, turn order and notes for one campaign. DM only.
import { Router } from 'express';
import { getDmPage, initiative, notes } from '../controllers/dmController.js';

const router = Router();

router.get('/campaigns/:id/dm', getDmPage);
router.post('/campaigns/:id/initiative', initiative);
router.put('/campaigns/:id/dm-notes', notes);

export default router;
