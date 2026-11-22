// The monsters a DM adds to a campaign (campaign_monsters, R5.6). The stat block lives in the content pack
// (monsterPack.js); a row keeps what changes in play.
import pool from '../db.js';

// This user's role in the campaign: 'dm', 'player' or null (not a member)
export async function memberRole(campId, userId) {
    const { rows } = await pool.query(
        `SELECT role FROM campaign_members WHERE campaign_id = $1 AND user_id = $2`, [campId, userId]);
    return rows[0]?.role ?? null;
}

export async function isDm(campId, userId) {
    return (await memberRole(campId, userId)) === 'dm';
}

export async function listForCampaign(campId) {
    const { rows } = await pool.query(
        `SELECT * FROM campaign_monsters WHERE campaign_id = $1 ORDER BY created_at, id`, [campId]);
    return rows;
}

export async function getOne(id) {
    const { rows } = await pool.query(`SELECT * FROM campaign_monsters WHERE id = $1`, [id]);
    return rows[0];
}

export async function add(campId, monsterId, nickname, hp) {
    const { rows } = await pool.query(
        `INSERT INTO campaign_monsters (campaign_id, monster_id, nickname, current_hp)
         VALUES ($1, $2, $3, $4) RETURNING *`, [campId, monsterId, nickname, hp]);
    return rows[0];
}

// Saves the play state the rules worked out. Only these columns can change.
const STATE_COLUMNS = ['current_hp', 'temp_hp', 'conditions', 'exhaustion', 'notes'];

export async function saveState(id, fields) {
    const cols = STATE_COLUMNS.filter((c) => fields[c] !== undefined);
    if (cols.length === 0) return getOne(id);
    const values = cols.map((c) => (c === 'conditions' ? JSON.stringify(fields[c]) : fields[c]));
    const { rows } = await pool.query(
        `UPDATE campaign_monsters SET ${cols.map((c, i) => `${c} = $${i + 2}`).join(', ')} WHERE id = $1 RETURNING *`,
        [id, ...values]);
    return rows[0];
}

export async function remove(id) {
    await pool.query(`DELETE FROM campaign_monsters WHERE id = $1`, [id]);
}
