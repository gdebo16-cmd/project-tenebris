// What the DM page reads and saves per campaign (R5.7): the party, the notes and the turn order.
import pool from '../db.js';

// Each member's finished character in this campaign, with its owner (the sheet is loaded as the owner)
export async function partyOf(campId) {
    const { rows } = await pool.query(
        `SELECT m.user_id, u.username, m.character_id
         FROM campaign_members m
         JOIN users u ON u.id = m.user_id
         JOIN characters ch ON ch.id = m.character_id AND ch.user_id = m.user_id AND NOT ch.is_draft
         WHERE m.campaign_id = $1
         ORDER BY m.joined_at`,
        [campId]);
    return rows;
}

export async function getDmState(campId) {
    const { rows } = await pool.query(`SELECT id, name, dm_notes, initiative FROM campaigns WHERE id = $1`, [campId]);
    return rows[0];
}

export async function saveNotes(campId, notes) {
    const { rows } = await pool.query(`UPDATE campaigns SET dm_notes = $2 WHERE id = $1 RETURNING dm_notes`, [campId, notes]);
    return rows[0];
}

export async function saveInitiative(campId, state) {
    const { rows } = await pool.query(
        `UPDATE campaigns SET initiative = $2 WHERE id = $1 RETURNING initiative`, [campId, state == null ? null : JSON.stringify(state)]);
    return rows[0];
}
