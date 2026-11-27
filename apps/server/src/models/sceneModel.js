// models/sceneModel.js — scenes and their terrain (step 12). Only reads and saves; the controller decides who may.
import pool from '../db.js';
import { upgradeTerrain } from '@tenebris/rules/board';

// T0: a scene read from the database, with an old board's rule names (wall, water, ice) under today's names.
// Nothing else changes, and the next save stores the new names.
const upgraded = (row) => (row ? { ...row, terrain: upgradeTerrain(row.terrain) } : null);

// The campaign's active scene, or null when it has none
export async function activeScene(campId) {
    const { rows } = await pool.query(
        `SELECT s.id, s.name, s.terrain, s.surfaces, s.features, s.look, s.explored FROM campaigns c JOIN scenes s ON s.id = c.active_scene_id WHERE c.id = $1`,
        [campId]);
    return upgraded(rows[0]);
}

// Make a scene and make it the active one; answers it
export async function createActiveScene(campId, name) {
    const { rows } = await pool.query(
        `INSERT INTO scenes (campaign_id, name) VALUES ($1, $2) RETURNING id, name, terrain, surfaces, features, look, explored`, [campId, name]);
    await pool.query(`UPDATE campaigns SET active_scene_id = $1 WHERE id = $2`, [rows[0].id, campId]);
    return rows[0];
}

// The scene with its campaign (to check who may change it), or null
export async function getScene(sceneId) {
    const { rows } = await pool.query(`SELECT id, campaign_id, name, terrain, surfaces, features, look, explored FROM scenes WHERE id = $1`, [sceneId]);
    return upgraded(rows[0]);
}

// Save the whole terrain map
export async function saveTerrain(sceneId, terrain) {
    await pool.query(`UPDATE scenes SET terrain = $1 WHERE id = $2`, [JSON.stringify(terrain), sceneId]);
}

// Save the whole surfaces map (how hexes look: { "q,r": "cobble", ... })
export async function saveSurfaces(sceneId, surfaces) {
    await pool.query(`UPDATE scenes SET surfaces = $1 WHERE id = $2`, [JSON.stringify(surfaces), sceneId]);
}

// Save the whole features map (what the DM placed: { "q,r": { kind, size?, color? }, ... })
export async function saveFeatures(sceneId, features) {
    await pool.query(`UPDATE scenes SET features = $1 WHERE id = $2`, [JSON.stringify(features), sceneId]);
}

// Save the scene's look (mood, weather, room, map picture, heights)
export async function saveLook(sceneId, look) {
    await pool.query(`UPDATE scenes SET look = $1 WHERE id = $2`, [JSON.stringify(look), sceneId]);
}

// ---- Tokens (step 13) ----

// Every token on a scene, with what the board shows: a name (its own, or the character's / monster's) and a picture
export async function listTokens(sceneId) {
    const { rows } = await pool.query(
        `SELECT t.id, t.kind, t.q, t.r, t.owner_id, t.character_id, t.campaign_monster_id, t.name,
                ch.name AS character_name, ch.portrait_url AS character_portrait,
                ch.current_hp AS character_hp, ch.max_hp AS character_max_hp, ch.temp_hp AS character_temp_hp,
                ch.conditions AS character_conditions,
                to_jsonb(cm) AS monster_row
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
        `SELECT t.*, s.campaign_id, s.terrain, s.features, s.look FROM tokens t JOIN scenes s ON s.id = t.scene_id WHERE t.id = $1`, [tokenId]);
    return upgraded(rows[0]);
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

// The scenes a character or a monster has a token on (with their campaign and terrain)
export async function scenesWith({ characterId, campaignMonsterId }) {
    const { rows } = await pool.query(
        `SELECT DISTINCT s.id, s.campaign_id, s.terrain, s.surfaces, s.features, s.look, s.explored
         FROM tokens t JOIN scenes s ON s.id = t.scene_id
         WHERE ($1::int IS NOT NULL AND t.character_id = $1) OR ($2::int IS NOT NULL AND t.campaign_monster_id = $2)`,
        [characterId ?? null, campaignMonsterId ?? null]);
    return rows.map(upgraded);
}

// Step 18: save what the party has seen on a scene ({ "q,r": 1, ... })
export async function saveExplored(sceneId, explored) {
    await pool.query(`UPDATE scenes SET explored = $1 WHERE id = $2`, [JSON.stringify(explored), sceneId]);
}

// ---- Overlays: spell areas and other shapes on a scene (step 17) ----
// shape: { area: { kind, at, sizeFt }, from: { q, r } }  turns_left: null = stays until removed
// counts_token_id: whose turn ends count the overlay down

export async function listOverlays(sceneId) {
    const { rows } = await pool.query(
        `SELECT id, name, owner_id, shape, turns_left, counts_token_id FROM overlays WHERE scene_id = $1 ORDER BY id`, [sceneId]);
    return rows;
}

// One overlay with its scene's campaign (to check who may remove it), or null
export async function getOverlay(id) {
    const { rows } = await pool.query(
        `SELECT o.*, s.campaign_id FROM overlays o JOIN scenes s ON s.id = o.scene_id WHERE o.id = $1`, [id]);
    return rows[0] ?? null;
}

export async function addOverlay(sceneId, { name, ownerId, shape, turnsLeft, countsTokenId }) {
    const { rows } = await pool.query(
        `INSERT INTO overlays (scene_id, name, owner_id, shape, turns_left, counts_token_id)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [sceneId, name, ownerId ?? null, JSON.stringify(shape), turnsLeft ?? null, countsTokenId ?? null]);
    return rows[0].id;
}

// Clear map: every shape on the scene goes
export async function removeAllOverlays(sceneId) {
    await pool.query(`DELETE FROM overlays WHERE scene_id = $1`, [sceneId]);
}

export async function removeOverlay(id) {
    await pool.query(`DELETE FROM overlays WHERE id = $1`, [id]);
}

// A creature's turn ended: count down every overlay that counts its token's turns, and remove the ones that reach 0.
// Answers the ids of the scenes that changed.
export async function tickOverlays(tokenIds) {
    if (tokenIds.length === 0) return [];
    const { rows } = await pool.query(
        `UPDATE overlays SET turns_left = turns_left - 1
         WHERE counts_token_id = ANY($1::int[]) AND turns_left IS NOT NULL AND turns_left > 0
         RETURNING scene_id`, [tokenIds]);
    await pool.query(`DELETE FROM overlays WHERE turns_left = 0`);
    return [...new Set(rows.map((r) => r.scene_id))];
}

// ---- The board library (map editor): every board in a campaign, and which one is being played ----

// Every board in the campaign, oldest first, with how many tokens stand on it and whether it's the live one
export async function listScenes(campId) {
    const { rows } = await pool.query(
        `SELECT s.id, s.name, (c.active_scene_id = s.id) AS is_active,
                (SELECT count(*)::int FROM tokens t WHERE t.scene_id = s.id) AS token_count
           FROM scenes s JOIN campaigns c ON c.id = s.campaign_id
          WHERE s.campaign_id = $1 ORDER BY s.id`, [campId]);
    return rows;
}

// A new, empty board (not live). copyFrom: start from another board's map and look instead (tokens aren't copied).
export async function createScene(campId, name, copyFrom = null) {
    const { rows } = copyFrom
        ? await pool.query(
            `INSERT INTO scenes (campaign_id, name, terrain, surfaces, features, look)
             SELECT campaign_id, $2, terrain, surfaces, features, look FROM scenes WHERE id = $3 AND campaign_id = $1
             RETURNING id, name`, [campId, name, copyFrom])
        : await pool.query(`INSERT INTO scenes (campaign_id, name) VALUES ($1, $2) RETURNING id, name`, [campId, name]);
    return rows[0] ?? null;
}

export async function renameScene(sceneId, name) {
    await pool.query(`UPDATE scenes SET name = $1 WHERE id = $2`, [name, sceneId]);
}

// Deleting a board also deletes its tokens and shapes (the database cascades)
export async function deleteScene(sceneId) {
    await pool.query(`DELETE FROM scenes WHERE id = $1`, [sceneId]);
}

// Make a board the one being played
export async function setActiveScene(campId, sceneId) {
    await pool.query(`UPDATE campaigns SET active_scene_id = $1 WHERE id = $2`, [sceneId, campId]);
}

export async function activeSceneId(campId) {
    const { rows } = await pool.query(`SELECT active_scene_id FROM campaigns WHERE id = $1`, [campId]);
    return rows[0]?.active_scene_id ?? null;
}
