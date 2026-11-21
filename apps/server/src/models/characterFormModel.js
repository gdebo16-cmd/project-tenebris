// Database reads and writes for the unified character form (R4).
// Controllers call these; they never write SQL themselves.
import pool from '../db.js';
import { legacyRaceIdForSpecies, legacySubraceIdForSpecies, legacyClassIdForRole, legacySubclassIdForCalling } from './idMap.js';

// The columns the form is allowed to change. Anything else a tab check returns is a bug, so it throws.
const FORM_COLUMNS = new Set([
    'name', 'level', 'portrait_url',
    'species_id', 'size_id', 'variant', 'eye_color', 'look_description',
    'role_id', 'calling_id', 'skill_proficiencies', 'feature_choices',
    'str', 'dex', 'con', 'int', 'wis', 'cha', 'luc', 'spd', 'plus2_stat', 'plus1_stat', 'stat_rolls',
    'alignment_code', 'upbringing_id', 'lifestyle_id', 'outlook_id', 'upbringing_state', 'lifestyle_state', 'outlook_state',
    'money',
]);

// A new, empty character marked as a draft. Answers its id.
export async function createDraft(userId, { name, level, portrait_url }) {
    const { rows } = await pool.query(
        `INSERT INTO characters (user_id, name, level, portrait_url, is_draft)
         VALUES ($1, $2, $3, $4, true)
         RETURNING id`,
        [userId, name, level, portrait_url]
    );
    return rows[0].id;
}

// Everything the form shows for one character, plus user_id for the ownership check
export async function getFormCharacter(charId) {
    const { rows } = await pool.query(
        `SELECT id, user_id, is_draft, name, level, portrait_url,
                species_id, size_id, variant, eye_color, look_description,
                role_id, calling_id, skill_proficiencies, feature_choices,
                str, dex, con, "int", wis, cha, luc, spd, plus2_stat, plus1_stat, stat_rolls,
                alignment_code, upbringing_id, lifestyle_id, outlook_id,
                upbringing_state, lifestyle_state, outlook_state, money
         FROM characters WHERE id = $1`,
        [charId]
    );
    return rows[0];
}

// Saves the clean values a tab check returned: { name: 'Ash', level: 3 } -> UPDATE ... SET name = $1, level = $2
export async function updateCharacterFields(charId, values) {
    const columns = Object.keys(values);
    if (columns.length === 0) return;
    for (const column of columns) {
        if (!FORM_COLUMNS.has(column)) throw new Error(`The form can't change characters.${column}`);
    }
    // "int" is a SQL keyword. jsonb columns need a cast; node-pg will not guess them.
    const jsonb = new Set(['feature_choices', 'stat_rolls']);
    const sets = columns.map((column, i) => {
        const name = column === 'int' ? '"int"' : column;
        return `${name} = $${i + 2}${jsonb.has(column) ? '::jsonb' : ''}`;
    }).join(', ');
    const params = columns.map((column) => jsonb.has(column) ? JSON.stringify(values[column]) : values[column]);
    await pool.query(`UPDATE characters SET ${sets} WHERE id = $1`, [charId, ...params]);
}

// The one weapon, one armor and items this form saved. Equipped row wins when several exist.
export async function getFormGear(charId) {
    const weapons = await pool.query(`SELECT weapon_id, is_equipped FROM character_weapons WHERE character_id = $1`, [charId]);
    const armor = await pool.query(`SELECT armor_id, is_equipped FROM character_armor WHERE character_id = $1`, [charId]);
    const items = await pool.query(`SELECT item_id FROM character_items WHERE character_id = $1 ORDER BY item_id`, [charId]);
    const weapon = weapons.rows.find((row) => row.is_equipped) ?? weapons.rows[0];
    const piece = armor.rows.find((row) => row.is_equipped) ?? armor.rows[0];
    return {
        weapon_id: weapon ? Number(weapon.weapon_id) : null,
        armor_id: piece ? Number(piece.armor_id) : null,
        item_ids: items.rows.map((row) => Number(row.item_id)),
    };
}

// Replaces this character's whole kit. The form owns the kit until R4.9; it is not a partial edit.
export async function replaceFormGear(charId, { weapon_id, armor_id, item_ids }) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query(`DELETE FROM character_weapons WHERE character_id = $1`, [charId]);
        await client.query(`DELETE FROM character_armor WHERE character_id = $1`, [charId]);
        await client.query(`DELETE FROM character_items WHERE character_id = $1`, [charId]);
        if (weapon_id != null) {
            await client.query(
                `INSERT INTO character_weapons (character_id, weapon_id, is_equipped) VALUES ($1, $2, true)`,
                [charId, weapon_id]
            );
        }
        if (armor_id != null) {
            await client.query(
                `INSERT INTO character_armor (character_id, armor_id, is_equipped) VALUES ($1, $2, true)`,
                [charId, armor_id]
            );
        }
        for (const itemId of item_ids) {
            await client.query(
                `INSERT INTO character_items (character_id, item_id, quantity) VALUES ($1, $2, 1)`,
                [charId, itemId]
            );
        }
        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

// The sheet still reads class_id and subclass_id. A finished character's role save keeps them in step.
// Drafts wait until finish. These columns go away in R7.
export async function syncLegacyClass(charId, roleId, callingId) {
    await pool.query(
        `UPDATE characters SET class_id = $2, subclass_id = $3 WHERE id = $1`,
        [charId, await legacyClassIdForRole(roleId), await legacySubclassIdForCalling(callingId)]
    );
}

// Marks a draft as finished with its starting HP.
// Also fills the old race/class ids, because the current sheet still reads them (they go away in R7).
export async function finishCharacter(ch, maxHp) {
    await pool.query(
        `UPDATE characters
         SET is_draft = false, max_hp = $2, current_hp = $2,
             race_id = $3, subrace_id = $4, class_id = $5, subclass_id = $6, last_swap_level = level
         WHERE id = $1`,
        [ch.id, maxHp,
         await legacyRaceIdForSpecies(ch.species_id), await legacySubraceIdForSpecies(ch.species_id),
         await legacyClassIdForRole(ch.role_id), await legacySubclassIdForCalling(ch.calling_id)]
    );
}
