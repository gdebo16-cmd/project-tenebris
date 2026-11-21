// Sheet routes (R5): one creature shape for every sheet layout. Mounted inside routes/api.js, so these sit under /api.
import { Router } from 'express';
import { getCharacterSheet, act } from '../controllers/sheetController.js';

const router = Router();

router.get('/sheets/character/:id', getCharacterSheet);
router.post('/sheets/character/:id/act', act);

export default router;
