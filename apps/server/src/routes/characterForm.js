// Routes for the unified character form (R4). Mounted inside routes/api.js, so these sit under /api.
import { Router } from 'express';
import { getOptions } from '../controllers/characterOptionsController.js';

const router = Router();

router.get('/character-options', getOptions);

export default router;