// Sheet routes (R5): one creature shape for every sheet layout. Mounted inside routes/api.js, so these sit under /api.
import { Router } from 'express';
import { getCharacterSheet, act, useFeature, useRune, rest, cast, getSpellbook, changeBook, money, conditions, hp, tempHp } from '../controllers/sheetController.js';

const router = Router();

router.get('/sheets/character/:id', getCharacterSheet);
router.post('/sheets/character/:id/act', act);
router.post('/sheets/character/:id/feature', useFeature);
router.post('/sheets/character/:id/rune', useRune);
router.post('/sheets/character/:id/rest', rest);
router.post('/sheets/character/:id/cast', cast);
router.get('/sheets/character/:id/spellbook', getSpellbook);
router.post('/sheets/character/:id/spellbook', changeBook);
router.post('/sheets/character/:id/money', money);
router.post('/sheets/character/:id/conditions', conditions);
router.post('/sheets/character/:id/hp', hp);
router.post('/sheets/character/:id/temp-hp', tempHp);

export default router;
