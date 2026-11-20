// POST /api/roll: the browser asks for dice, the server rolls them.
// Body: { rolls: { hit: { type: 'd20', bonus: 5 }, damage: { type: 'dice', dice: '1d8+3' } } }
// Answer: the same names with their results. The rules for each roll type live in @tenebris/rules/dice.
import { checkRollRequest, rollAll } from '@tenebris/rules/dice';
import { rng } from '../dice.js';

export function roll(req, res) {
    if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });
    const checked = checkRollRequest(req.body);
    if ('error' in checked) return res.status(400).json({ error: checked.error });
    res.json(rollAll(checked.rolls, rng));
}
