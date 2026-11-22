// Game content: the rulebook pack and the spell list.
import { Router } from 'express';
import { getContent, getSpells } from '../controllers/contentController.js';

const router = Router();

router.get('/content', getContent);
router.get('/content/spells', getSpells);

export default router;
