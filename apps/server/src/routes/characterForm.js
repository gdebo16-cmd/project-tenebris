// Routes for the unified character form (R4). Mounted inside routes/api.js, so these sit under /api.
import { Router } from 'express';
import { getOptions } from '../controllers/characterOptionsController.js';
import { createDraft, getForm, saveTab, finish } from '../controllers/characterFormController.js';

const router = Router();

router.get('/character-options', getOptions);
router.post('/characters', createDraft);
router.get('/characters/:id/form', getForm);
router.put('/characters/:id/form/:tab', saveTab);
router.post('/characters/:id/finish', finish);

export default router;