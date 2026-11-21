// GET /api/character-options?level=3&species_id=1&role_id=1&calling_id=3
// Answers "what can this character pick?" for the character form. The rules live in @tenebris/rules.
import pack from '../models/formPack.js';   // the content pack + looks.json, joined once at startup
import { characterOptions } from '@tenebris/rules/characterOptions';
import { MAX_LEVEL } from '@tenebris/rules/characterForm';

// Query values always arrive as text: "5" -> 5, missing or "" -> undefined (not picked yet)
const optionalNumber = (value) => (value === undefined || value === '' ? undefined : Number(value));

export function getOptions(req, res) {
    if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });

    const level = Number(req.query.level ?? 1);
    // New characters stop at MAX_LEVEL. A character already above it can still ask what that
    // level can pick, so a higher whole number is allowed on this read.
    if (!Number.isInteger(level) || level < 1) {
        return res.status(400).json({ error: `Level must be a whole number from 1 to ${MAX_LEVEL}` });
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