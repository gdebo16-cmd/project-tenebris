// Table dice (step 15): the server rolls, everyone in the campaign sees the same roll.
import { Router } from 'express';
import { rollDice } from '../controllers/diceController.js';

const router = Router();

router.post('/campaigns/:id/dice', rollDice);

export default router;