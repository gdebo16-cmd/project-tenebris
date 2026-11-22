// Dice: the browser asks, the server rolls (rules in @tenebris/rules/dice).
import { Router } from 'express';
import { roll } from '../controllers/apiRollController.js';

const router = Router();

router.post('/roll', roll);

export default router;
