// Money (R5): the five coin columns on characters (migration 1795282460378_add-character-money).
// One UPDATE per change, so two changes at the same moment can't both spend the same coins.
// ownerId = the character's owner (the controller has already checked who may change it).
import pool from '../db.js';
import { COINS } from '@tenebris/rules/money';

const RETURNING = `RETURNING ${COINS.join(', ')}`;

// Adds coins. Returns the new totals, or undefined if the character isn't there.
export async function addMoney(charId, ownerId, amounts) {
    const sets = COINS.map((c, i) => `${c} = ${c} + $${i + 3}`).join(', ');
    const { rows } = await pool.query(
        `UPDATE characters SET ${sets} WHERE id = $1 AND user_id = $2 ${RETURNING}`,
        [charId, ownerId, ...COINS.map((c) => amounts[c])]
    );
    return rows[0];
}

// Spends coins only if every coin stays at 0 or more (the CHECK constraints are the backup).
// Returns the new totals, or undefined if the purse is short (or the character isn't there).
export async function spendMoney(charId, ownerId, amounts) {
    const sets = COINS.map((c, i) => `${c} = ${c} - $${i + 3}`).join(', ');
    const enough = COINS.map((c, i) => `${c} >= $${i + 3}`).join(' AND ');
    const { rows } = await pool.query(
        `UPDATE characters SET ${sets} WHERE id = $1 AND user_id = $2 AND ${enough} ${RETURNING}`,
        [charId, ownerId, ...COINS.map((c) => amounts[c])]
    );
    return rows[0];
}

// The purse as it is now, or undefined
export async function getPurse(charId, ownerId) {
    const { rows } = await pool.query(
        `SELECT ${COINS.join(', ')} FROM characters WHERE id = $1 AND user_id = $2`,
        [charId, ownerId]
    );
    return rows[0];
}
