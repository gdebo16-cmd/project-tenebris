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