// Dice anyone at the table can see (step 15). The server rolls; every browser in the campaign plays the same roll.
// One throw can hold several dice of different sizes, plus a bonus: 2d6 + 1d8 + 3.
import * as Monsters from '../models/monsterModel.js';   // memberRole(campId, userId)
import { rng } from '../dice.js';

const SIDES = [4, 6, 8, 10, 12, 20];
const MAX_DICE = 20;            // one throw at most 20 dice: plenty, and stops silly requests

// POST /api/campaigns/:id/dice   body { dice: [{ sides, count }], bonus? }  -> the roll (also sent to the campaign as 'dice')
// The roll: { dice: [{ sides, value, start, spin }], bonus, total, by, at }. Each die has its own start and spin so they
// tumble differently; only "value" (from the server's fair dice) matters for the game.
export async function rollDice(req, res) {
    if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });
    const campId = Number(req.params.id);
    const role = Number.isInteger(campId) ? await Monsters.memberRole(campId, req.session.userId) : null;
    if (!role) return res.status(404).json({ error: 'Campaign not found' });

    const groups = Array.isArray(req.body?.dice) ? req.body.dice : [];
    const bonus = Number(req.body?.bonus ?? 0);
    if (!Number.isInteger(bonus) || Math.abs(bonus) > 100) return res.status(400).json({ error: 'bonus must be a whole number from -100 to 100' });

    const dice = [];
    for (const g of groups) {
        const sides = Number(g?.sides), count = Number(g?.count);
        if (!SIDES.includes(sides)) return res.status(400).json({ error: `sides must be one of ${SIDES.join(', ')}` });
        if (!Number.isInteger(count) || count < 1) return res.status(400).json({ error: 'count must be 1 or more' });
        if (dice.length + count > MAX_DICE) return res.status(400).json({ error: `At most ${MAX_DICE} dice at once` });
        for (let i = 0; i < count; i++) {
            dice.push({
                sides,
                value: rng(sides),                                    // the real result
                start: [Math.random(), Math.random(), Math.random()], // looks only
                spin: Math.random(),                                  // looks only
            });
        }
    }
    if (dice.length === 0) return res.status(400).json({ error: 'Choose at least one die' });

    const roll = {
        dice,
        bonus,
        total: dice.reduce((sum, d) => sum + d.value, 0) + bonus,
        by: req.session.userId,
        at: Date.now(),
    };
    req.app.get('io')?.to(`campaign:${campId}`).emit('dice', roll);
    res.json(roll);
}
