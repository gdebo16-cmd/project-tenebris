// models/sceneModel.js — scenes and their terrain (step 12). Only reads and saves; the controller decides who may.
import pool from '../db.js';

// The campaign's active scene, or null when it has none
export async function activeScene(campId) {
    const { rows } = await pool.query(
        `SELECT s.id, s.name, s.terrain FROM campaigns c JOIN scenes s ON s.id = c.active_scene_id WHERE c.id = $1`,
        [campId]);
    return rows[0] ?? null;
}

// Make a scene and make it the active one; answers it
export async function createActiveScene(campId, name) {
    const { rows } = await pool.query(
        `INSERT INTO scenes (campaign_id, name) VALUES ($1, $2) RETURNING id, name, terrain`, [campId, name]);
    await pool.query(`UPDATE campaigns SET active_scene_id = $1 WHERE id = $2`, [rows[0].id, campId]);
    return rows[0];
}

// The scene with its campaign (to check who may change it), or null
export async function getScene(sceneId) {
    const { rows } = await pool.query(`SELECT id, campaign_id, terrain FROM scenes WHERE id = $1`, [sceneId]);
    return rows[0] ?? null;
}

// Save the whole terrain map
export async function saveTerrain(sceneId, terrain) {
    await pool.query(`UPDATE scenes SET terrain = $1 WHERE id = $2`, [JSON.stringify(terrain), sceneId]);
}

// ---- Tokens (step 13) ----

// Every token on a scene, with what the board shows: a name (its own, or the character's / monster's) and a picture
export async function listTokens(sceneId) {
    const { rows } = await pool.query(
        `SELECT t.id, t.kind, t.q, t.r, t.owner_id, t.character_id, t.campaign_monster_id, t.name,
                ch.name AS character_name, ch.portrait_url AS character_portrait,
                cm.nickname AS monster_nickname, cm.monster_id
         FROM tokens t
         LEFT JOIN characters ch ON ch.id = t.character_id
         LEFT JOIN campaign_monsters cm ON cm.id = t.campaign_monster_id
         WHERE t.scene_id = $1
         ORDER BY t.id`,
        [sceneId]);
    return rows;
}

// One token with its scene's campaign (to check who may move it), or null
export async function getToken(tokenId) {
    const { rows } = await pool.query(
        `SELECT t.*, s.campaign_id, s.terrain FROM tokens t JOIN scenes s ON s.id = t.scene_id WHERE t.id = $1`, [tokenId]);
    return rows[0] ?? null;
}

// Put a token on a scene. Throws the database's "unique" error (code 23505) when the hex is taken.
export async function addToken(sceneId, { kind, characterId, campaignMonsterId, ownerId, name, q, r }) {
    const { rows } = await pool.query(
        `INSERT INTO tokens (scene_id, kind, character_id, campaign_monster_id, owner_id, name, q, r)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
        [sceneId, kind, characterId ?? null, campaignMonsterId ?? null, ownerId ?? null, name ?? null, q, r]);
    return rows[0].id;
}

// Move a token. Same 23505 error when the hex is taken.
export async function moveToken(tokenId, q, r) {
    await pool.query(`UPDATE tokens SET q = $1, r = $2 WHERE id = $3`, [q, r, tokenId]);
}

export async function removeToken(tokenId) {
    await pool.query(`DELETE FROM tokens WHERE id = $1`, [tokenId]);
}

// The players' finished characters in this campaign, which the DM can place as tokens
export async function partyForTable(campId) {
    const { rows } = await pool.query(
        `SELECT m.user_id, u.username, ch.id AS character_id, ch.name
         FROM campaign_members m
         JOIN users u ON u.id = m.user_id
         JOIN characters ch ON ch.id = m.character_id AND ch.user_id = m.user_id AND NOT ch.is_draft
         WHERE m.campaign_id = $1
         ORDER BY m.joined_at`,
        [campId]);
    return rows;
}
