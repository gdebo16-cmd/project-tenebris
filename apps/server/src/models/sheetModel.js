// Who may see and change a sheet. One question, three answers:
//   'owner'  — the player who made the character
//   'dm'     — the DM of a campaign the character plays in
//   'viewer' — another player in one of those campaigns (read-only)
//   null     — nobody else sees it
import pool from '../db.js';

export async function sheetAccess(charId, userId) {
    const { rows } = await pool.query(
        `SELECT ch.user_id,
                EXISTS (SELECT 1 FROM campaign_members pm
                        JOIN campaign_members dm ON dm.campaign_id = pm.campaign_id
                        WHERE pm.character_id = ch.id AND dm.user_id = $2 AND dm.role = 'dm') AS is_dm,
                EXISTS (SELECT 1 FROM campaign_members pm
                        JOIN campaign_members other ON other.campaign_id = pm.campaign_id
                        WHERE pm.character_id = ch.id AND other.user_id = $2) AS shares_campaign
         FROM characters ch
         WHERE ch.id = $1 AND NOT ch.is_draft`,
        [charId, userId]
    );
    const row = rows[0];
    if (!row) return { access: null, ownerId: null };
    if (Number(row.user_id) === Number(userId)) return { access: 'owner', ownerId: row.user_id };
    if (row.is_dm) return { access: 'dm', ownerId: row.user_id };
    if (row.shares_campaign) return { access: 'viewer', ownerId: row.user_id };
    return { access: null, ownerId: row.user_id };
}
