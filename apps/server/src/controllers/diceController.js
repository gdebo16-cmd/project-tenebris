// The dice tray (step 15). The roller's browser throws physics dice and reads what landed;
// the server checks the values are possible, adds them up and posts one line to the campaign's roll feed.
// (Owner's call, 2026-11-23: couch game, feel over anti-cheat. Game rolls like attacks still use ../dice.js.)
// One throw can hold several dice of different sizes, plus a bonus: 2d6 + 1d8 + 3.
import * as Monsters from '../models/monsterModel.js';   // memberRole(campId, userId)

const SIDES = [4, 6, 8, 10, 12, 20];
const MAX_DICE = 20;            // one throw at most 20 dice: plenty, and stops silly requests

// POST /api/campaigns/:id/dice   body { dice: [{ sides, value }], bonus? }  -> the feed line (also sent to the campaign as 'roll-feed')
// The feed line: { dice: [{ sides, value }], bonus, total, by, name, at }
export async function rollDice(req, res) {
    if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });
    const campId = Number(req.params.id);
    const role = Number.isInteger(campId) ? await Monsters.memberRole(campId, req.session.userId) : null;
    if (!role) return res.status(404).json({ error: 'Campaign not found' });

    const thrown = Array.isArray(req.body?.dice) ? req.body.dice : [];
    const bonus = Number(req.body?.bonus ?? 0);
    if (!Number.isInteger(bonus) || Math.abs(bonus) > 100) return res.status(400).json({ error: 'bonus must be a whole number from -100 to 100' });
    if (thrown.length === 0) return res.status(400).json({ error: 'Choose at least one die' });
    if (thrown.length > MAX_DICE) return res.status(400).json({ error: `At most ${MAX_DICE} dice at once` });

    // check every die could really have landed that way: a d6 can't show 7
    const dice = [];
    for (const d of thrown) {
        const sides = Number(d?.sides), value = Number(d?.value);
        if (!SIDES.includes(sides)) return res.status(400).json({ error: `sides must be one of ${SIDES.join(', ')}` });
        if (!Number.isInteger(value) || value < 1 || value > sides) return res.status(400).json({ error: `A d${sides} shows 1 to ${sides}` });
        dice.push({ sides, value });
    }

    const line = {
        dice,
        bonus,
        total: dice.reduce((sum, d) => sum + d.value, 0) + bonus,
        by: req.session.userId,
        name: req.session.username,
        at: Date.now(),
    };
    req.app.get('io')?.to(`campaign:${campId}`).emit('roll-feed', line);   // everyone (roller included) gets the line
    res.json(line);
}
