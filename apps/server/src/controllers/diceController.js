// Dice anyone at the table can see (step 15). The server rolls; every browser in the campaign plays the same roll.
import * as Monsters from '../models/monsterModel.js';   // memberRole(campId, userId)
import { rng } from '../dice.js';

const SIDES = [4, 6, 8, 10, 12, 20];   // the dice we'll support

// POST /api/campaigns/:id/dice   body { sides }  -> the roll (also sent to everyone in the campaign as 'dice')
export async function rollDice(req, res) {
    if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });
    const campId = Number(req.params.id);
    const role = Number.isInteger(campId) ? await Monsters.memberRole(campId, req.session.userId) : null;
    if (!role) return res.status(404).json({ error: 'Campaign not found' });

    const sides = Number(req.body?.sides);
    if (!SIDES.includes(sides)) return res.status(400).json({ error: `sides must be one of ${SIDES.join(', ')}` });

    const roll = {
        sides,
        value: rng(sides),                                       // the real result: the only part that matters for the game
        start: [Math.random(), Math.random(), Math.random()],    // how it's tilted when thrown (just for looks)
        spin: Math.random(),                                     // how it's turned when it lands (just for looks)
        by: req.session.userId,
        at: Date.now(),
    };
    req.app.get('io')?.to(`campaign:${campId}`).emit('dice', roll);
    res.json(roll);
}