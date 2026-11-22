// A player's own sheet layouts (users.sheet_layouts, L4): { character?: layout, monster?: layout }
import pool from '../db.js';

export async function getLayouts(userId) {
    const { rows } = await pool.query(`SELECT sheet_layouts FROM users WHERE id = $1`, [userId]);
    return rows[0]?.sheet_layouts ?? {};
}

// Saves one kind's layout (null removes it, so the default is used again). Answers all the player's layouts.
export async function saveLayout(userId, kind, layout) {
    const { rows } = await pool.query(
        layout === null
            ? `UPDATE users SET sheet_layouts = sheet_layouts - $2 WHERE id = $1 RETURNING sheet_layouts`
            : `UPDATE users SET sheet_layouts = jsonb_set(sheet_layouts, ARRAY[$2], $3::jsonb) WHERE id = $1 RETURNING sheet_layouts`,
        layout === null ? [userId, kind] : [userId, kind, JSON.stringify(layout)]);
    return rows[0]?.sheet_layouts ?? {};
}
