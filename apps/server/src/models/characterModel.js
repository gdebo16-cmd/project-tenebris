// Character database reads and writes: sheet data, hp, levels, stats, create/delete.
import pool from '../db.js';
import { withEffectiveScores, effectiveScores, getBoostRows } from '../utils/abilityBoosts.js';
import { getSpellCaps } from '@tenebris/rules/spellLimits';

import content, { getRole, getCalling, scoreKey, hitDieSides } from './content.js';
import { MAX_LEVEL } from '@tenebris/rules/characterForm';

// a character can only have a subclass from this level up (creator + editor check this too)
export const SUBCLASS_LEVEL = 3;
export { MAX_LEVEL };

function featureById(id) {
    return (content.features ?? []).find((f) => Number(f.id) === Number(id));
}
function personalityById(id) {
    return (content.personality_options ?? []).find((p) => Number(p.id) === Number(id));
}
function speciesById(id) {
    return (content.species ?? []).find((s) => Number(s.id) === Number(id));
}
function hpBonusFromPack(callingId, level) {
    if (callingId == null || callingId === '') return 0;
    const lvl = Number(level) || 1;
    let per = 0;
    for (const cf of content.calling_features ?? []) {
        if (Number(cf.calling_id) !== Number(callingId)) continue;
        if (Number(cf.level) > lvl) continue;
        per += Number(cf.hp_per_level) || 0;
    }
    return per * lvl;
}
function enrichSheetFields(ch) {
    if (!ch) return ch;
    const sp = speciesById(ch.species_id);
    const parent = sp?.parent_id != null ? speciesById(sp.parent_id) : null;
    const role = getRole(ch.role_id);
    const calling = getCalling(role, ch.calling_id);
    const legacyRace = (content.legacy_races ?? []).find((r) => Number(r.id) === Number(ch.race_id));
    const legacySub = (content.legacy_subraces ?? []).find((r) => Number(r.id) === Number(ch.subrace_id));
    ch.race_name = parent?.name ?? sp?.name ?? legacyRace?.name ?? null;
    ch.subrace_name = sp?.parent_id != null ? sp.name : (legacySub?.name ?? null);
    ch.class_name = role?.name ?? null;
    ch.hitpoint_die = hitDieSides(role?.hit_die);
    ch.subclass_spellcasting_stat = calling?.spellcasting_stat || null;
    ch.class_spellcasting_stat = role?.spell_stat || null;
    ch.caster_type = calling?.caster_type || role?.caster_type || null;
    ch.has_embers = role?.has_embers ?? false;
    ch.crack_max = role?.crack_max ?? null;
    ch.breach_dc = role?.breach_dc ?? null;
    ch.breach_dc_scaling = role?.breach_dc_scaling ?? null;
    ch.class_saving_throws = role?.saving_throws ?? null;
    ch.breach_effect = calling?.breach_effect ?? null;
    ch.breach_drains_embers = calling?.breach_drains_embers ?? false;
    const armorParts = [role?.armor_prof, calling?.armor_prof].filter(Boolean);
    const weaponParts = [role?.weapon_prof, calling?.weapon_prof].filter(Boolean);
    const toolParts = [role?.tool_prof, calling?.tool_prof].filter(Boolean);
    ch.armor_proficiencies = armorParts.length ? armorParts.join(', ') : null;
    ch.weapon_proficiencies = weaponParts.length ? weaponParts.join(', ') : null;
    ch.tool_proficiencies = toolParts.length ? toolParts.join(', ') : null;
    ch.subclass_name = calling?.name ?? null;
    ch.race_base_speed = sp?.speed ?? parent?.speed ?? legacyRace?.base_speed ?? null;
    ch.race_darkvision = !!(sp?.darkvision ?? parent?.darkvision ?? legacyRace?.darkvision);
    for (const cat of ['upbringing', 'lifestyle', 'outlook']) {
        const p = personalityById(ch[`${cat}_id`]);
        ch[`${cat}_name`] = p?.name ?? null;
        ch[`${cat}_flavor`] = p?.flavor ?? null;
        ch[`${cat}_bio`] = p?.bio ?? null;
        ch[`${cat}_perk`] = p?.perk ?? null;
    }
    return ch;
}

export function effMaxSql(base, _alias, conBonus) {
    return `(${base} + ${conBonus})`;
}
const scoreMod = (s) => Math.floor((Number(s) || 0) / 2) - 5;
// Extra HP from Ability Boost / Primordial Ascent CON picks, retroactive like 5e: (effective CON mod - base CON mod) x level
// ch needs class_id, con (base), feature_choices, level
export async function conHpBonus(ch, level = ch?.level) {
    if (!ch?.class_id) return 0;
    const lvl = Number(level) || 1;
    const eff = effectiveScores(ch, await getBoostRows(ch.class_id), ch.feature_choices ?? {}, lvl);
    return Math.max(0, (scoreMod(eff.con) - scoreMod(ch.con)) * lvl);
}

// true if this character belongs to the logged-in user
export async function ownsCharacter(charId, userId) {
    const { rows } = await pool.query(
        `SELECT id FROM characters WHERE id = $1 AND user_id = $2`,
        [charId, userId]
    );
    return rows.length > 0;
}

// Full sheet row (with race/class/subclass names) or undefined
export async function getSheetCharacter(charId, userId) {
    const { rows } = await pool.query(
        `SELECT ch.*
        FROM characters ch
        WHERE ch.id = $1 AND (ch.user_id = $2 OR EXISTS (
            SELECT 1 FROM campaign_members pm
            JOIN campaign_members dm ON dm.campaign_id = pm.campaign_id
            WHERE pm.character_id = ch.id AND dm.user_id = $2 AND dm.role = 'dm'))`,
        [charId, userId]
    );
    if (rows[0]) {
        enrichSheetFields(rows[0]);
        rows[0].hp_bonus = hpBonusFromPack(rows[0].calling_id, rows[0].level);
        rows[0].legacy_subclass_id = rows[0].subclass_id;
        rows[0].subclass_id = rows[0].calling_id;
        const role = getRole(rows[0].role_id);
        const primary = scoreKey(role?.primary_stat);
        rows[0].spell_stat = primary ?? 'str';
        rows[0].casting_stat = scoreKey(role?.spell_stat)
            ?? scoreKey(rows[0].subclass_spellcasting_stat)
            ?? scoreKey(rows[0].class_spellcasting_stat)
            ?? primary
            ?? 'str';
        rows[0].max_hp = Number(rows[0].max_hp) + Number(rows[0].hp_bonus || 0) + await conHpBonus(rows[0]);
        rows[0].spell_limits = getSpellCaps(rows[0].class_name, rows[0].level, rows[0].subclass_name);
    }
    return withEffectiveScores(rows[0]);
}

export async function listCharactersForUser(userId) {
    return listCharacters(userId, false);
}

// Drafts for the home page's Unfinished list. Kept apart from finished characters.
export async function listDraftsForUser(userId) {
    return listCharacters(userId, true);
}

async function listCharacters(userId, drafts) {
    const { rows } = await pool.query(
        `SELECT ch.id, ch.name, ch.portrait_url, ch.species_id, ch.role_id, ch.calling_id
        FROM characters ch
        WHERE ch.user_id = $1 AND ch.is_draft = $2
        ORDER BY ch.name`,
        [userId, drafts]
    );
    return rows.map((ch) => {
        const sp = speciesById(ch.species_id);
        const parent = sp?.parent_id != null ? speciesById(sp.parent_id) : null;
        const role = getRole(ch.role_id);
        const calling = getCalling(role, ch.calling_id);
        return {
            id: ch.id,
            name: ch.name,
            portrait_url: ch.portrait_url,
            race: parent?.name ?? sp?.name ?? null,
            class: role?.name ?? null,
            subclass: calling?.name ?? null,
        };
    });
}

// Heal (+) or damage (-), clamped to 0..effective max HP (see effMaxSql). Damage comes off temp_hp first; healing never touches temp_hp.
// Returns { current_hp, temp_hp, max_hp } or undefined
export async function changeHp(charId, userId, change) {
    const { rows: found } = await pool.query(
        `SELECT id, class_id, calling_id, con, level, feature_choices, max_hp FROM characters WHERE id = $1 AND user_id = $2`,
        [charId, userId]
    );
    if (!found[0]) return undefined;
    const ch = found[0];
    const conBonus = await conHpBonus(ch);
    const effMax = Number(ch.max_hp) + hpBonusFromPack(ch.calling_id, ch.level) + conBonus;
    const { rows } = await pool.query(
        `UPDATE characters c
            SET temp_hp = CASE WHEN $1::int < 0 THEN GREATEST(0, c.temp_hp + $1::int) ELSE c.temp_hp END,
                current_hp = LEAST($4::int,
                    GREATEST(0, c.current_hp + CASE WHEN $1::int < 0 THEN LEAST(0, $1::int + c.temp_hp) ELSE $1::int END))
          WHERE c.id = $2 AND c.user_id = $3
          RETURNING c.current_hp, c.temp_hp, $4::int AS max_hp`,
        [change, charId, userId, effMax]
    );
    return rows[0];
}

// Temporary HP doesn't stack: keeps the higher of the current and new amount. clear = true sets it to 0 (long rest).
// Returns { temp_hp } or undefined
export async function setTempHp(charId, userId, amount, clear = false) {
    const { rows } = await pool.query(
        `UPDATE characters SET temp_hp = CASE WHEN $4::boolean THEN 0 ELSE GREATEST(temp_hp, $1::int) END
          WHERE id = $2 AND user_id = $3
          RETURNING temp_hp`,
        [amount, charId, userId, clear]
    );
    return rows[0];
}

// Returns how many rows were deleted (0 or 1)
export async function deleteCharacter(charId, userId) {
    const { rowCount } = await pool.query(
        `DELETE FROM characters WHERE id = $1 AND user_id = $2`,
        [charId, userId]
    );
    return rowCount;
}

// ---------- character editor ----------

// level, con, max_hp and class hit die for the level-up math, or undefined
export async function getLevelInfo(charId, userId) {
    const { rows } = await pool.query(
        `SELECT ch.level, ch.con, ch.max_hp, ch.role_id
           FROM characters ch
          WHERE ch.id = $1 AND ch.user_id = $2`,
        [charId, userId]
    );
    if (rows[0]) rows[0].hitpoint_die = hitDieSides(getRole(rows[0].role_id)?.hit_die);
    return rows[0];
}

// Dropping below SUBCLASS_LEVEL clears the subclass and its feature picks
export async function updateLevel(charId, userId, level, newMax) {
    const { rows: found } = await pool.query(
        `SELECT id, class_id, calling_id, con, feature_choices FROM characters WHERE id = $1 AND user_id = $2`,
        [charId, userId]
    );
    const ch = found[0];
    const conBonus = ch ? await conHpBonus(ch, level) : 0;
    const callingForBonus = level < SUBCLASS_LEVEL ? null : ch?.calling_id;
    const effMax = Number(newMax) + hpBonusFromPack(callingForBonus, level) + conBonus;
    // clamp to the effective max at the new level (subclass bonus only from SUBCLASS_LEVEL up)
    await pool.query(
        `UPDATE characters
            SET level = $1, max_hp = $2, current_hp = LEAST(current_hp, $5::int),
                feature_choices = CASE WHEN $1::int < ${SUBCLASS_LEVEL} THEN
                        (SELECT COALESCE(jsonb_object_agg(k, v), '{}'::jsonb)
                           FROM jsonb_each(feature_choices) AS e(k, v) WHERE k NOT LIKE 'subclass:%')
                    ELSE feature_choices END,
                calling_id = CASE WHEN $1::int < ${SUBCLASS_LEVEL} THEN NULL ELSE calling_id END
          WHERE id = $3 AND user_id = $4`,
        [level, newMax, charId, userId, effMax]
    );
}

export async function getActionFeatures(roleId, callingId, level, speciesId) {
    const lvl = Number(level) || 1;
    const out = [];
    for (const rf of content.role_features ?? []) {
        if (Number(rf.role_id) !== Number(roleId) || Number(rf.level) > lvl) continue;
        if (rf.action_type == null && rf.ember_cost == null && rf.rest_uses == null) continue;
        out.push({
            source: 'class',
            id: rf.feature_id,
            name: rf.name,
            description: rf.description ?? rf.feature_description ?? '',
            level: rf.level,
            action_type: rf.action_type,
            uses: rf.uses,
            dice: rf.dice,
            ember_cost: rf.ember_cost,
            embers_per_die: rf.embers_per_die,
            cost_scaling: rf.cost_scaling,
            dice_scaling: rf.dice_scaling,
            rest_lock: rf.rest_lock,
            kindles_slot: rf.kindles_slot,
            cracks_gained: rf.cracks_gained,
            cracks_removed: rf.cracks_removed,
            rest_uses: rf.rest_uses,
            uses_scaling: rf.uses_scaling,
            on_weapon_hit: rf.on_weapon_hit,
        });
    }
    if (callingId != null && callingId !== '') {
        for (const cf of content.calling_features ?? []) {
            if (Number(cf.calling_id) !== Number(callingId) || Number(cf.level) > lvl) continue;
            if (cf.action_type == null && cf.ember_cost == null && cf.rest_uses == null) continue;
            out.push({
                source: 'subclass',
                id: cf.feature_id,
                name: cf.name,
                description: cf.description ?? cf.feature_description ?? '',
                level: cf.level,
                action_type: cf.action_type,
                uses: cf.uses,
                dice: cf.dice,
                ember_cost: cf.ember_cost,
                embers_per_die: cf.embers_per_die,
                cost_scaling: cf.cost_scaling,
                dice_scaling: cf.dice_scaling,
                rest_lock: cf.rest_lock,
                kindles_slot: cf.kindles_slot,
                cracks_gained: cf.cracks_gained,
                cracks_removed: cf.cracks_removed,
                rest_uses: cf.rest_uses,
                uses_scaling: cf.uses_scaling,
                on_weapon_hit: cf.on_weapon_hit,
            });
        }
    }
    if (speciesId != null && speciesId !== '') {
        for (const sf of content.species_features ?? []) {
            if (Number(sf.species_id) !== Number(speciesId) || Number(sf.level ?? 1) > lvl) continue;
            if (sf.action_type == null) continue;
            out.push({
                source: 'race',
                id: sf.feature_id,
                name: sf.name,
                description: sf.description ?? sf.feature_description ?? '',
                level: sf.level ?? 1,
                action_type: sf.action_type,
                uses: sf.uses,
                dice: sf.dice,
                ember_cost: null,
                embers_per_die: false,
                cost_scaling: null,
                dice_scaling: null,
                rest_lock: null,
                kindles_slot: false,
                cracks_gained: 0,
                cracks_removed: 0,
                rest_uses: null,
                uses_scaling: null,
                on_weapon_hit: false,
            });
        }
    }
    out.sort((a, b) => Number(a.level) - Number(b.level) || String(a.name).localeCompare(String(b.name)));
    return out;
}

// Saved sheet state (slots used, embers, Seal Cracks, uses per rest, conditions, exhaustion). Only the fields in `patch` change.
// Returns the saved state or undefined if the character isn't yours.
export const SHEET_STATE_FIELDS = ['used_slots', 'embers_spent', 'cracks', 'rest_uses', 'conditions', 'exhaustion'];
export async function updateSheetState(charId, userId, patch) {
    const fields = SHEET_STATE_FIELDS.filter((f) => f in patch);
    if (!fields.length) return undefined;
    const sets = fields.map((f, i) => `${f} = $${i + 3}`).join(', ');
    const { rows } = await pool.query(
        `UPDATE characters SET ${sets} WHERE id = $1 AND user_id = $2
         RETURNING ${SHEET_STATE_FIELDS.join(', ')}`,
        [charId, userId, ...fields.map((f) => (typeof patch[f] === 'object' ? JSON.stringify(patch[f]) : patch[f]))]
    );
    return rows[0];
}
