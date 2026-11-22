// Sheet layouts (L4): the player's own arrangement of the character and monster sheets.
import { Router } from 'express';
import { getLayouts, saveLayout, resetLayout } from '../controllers/layoutController.js';

const router = Router();

router.get('/layouts', getLayouts);
router.put('/layouts/:kind', saveLayout);
router.delete('/layouts/:kind', resetLayout);

export default router;
