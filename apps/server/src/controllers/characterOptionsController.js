// GET /api/character-options?level=3&species_id=1&role_id=1&calling_id=3
// Answers "what can this character pick?" for the character form. The rules live in @tenebris/rules.
import content from '../models/content.js';
import looks from '../models/looks.js';
import { characterOptions } from '@tenebris/rules/characterOptions';

// The rules function wants one pack with the looks inside it. Built once, not per request.
const pack = { ...content, looks };

// Query values always arrive as text: "5" -> 5, missing or "" -> undefined (not picked yet)
const optionalNumber = (value) => (value === undefined || value === '' ? undefined : Number(value));

export function getOptions(req, res) {
    if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });

    const level = Number(req.query.level ?? 1);
    if (!Number.isInteger(level) || level < 1 || level > 30) {
        return res.status(400).json({ error: 'Level must be a whole number from 1 to 30' });
    }

    const picks = {
        level,
        species_id: optionalNumber(req.query.species_id),
        role_id: optionalNumber(req.query.role_id),
        calling_id: optionalNumber(req.query.calling_id),
    };

    // Reject junk like role_id=abc. Missing picks are fine; they just mean "not picked yet".
    for (const [name, value] of Object.entries(picks)) {
        if (value !== undefined && !Number.isInteger(value)) {
            return res.status(400).json({ error: `${name} must be a whole number` });
        }
    }

    res.json(characterOptions(pack, picks));
}