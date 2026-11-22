import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { choiceKey } from '@tenebris/rules/characterOptions';
import { armorTypesFromProf, weaponCategoryNamesFromProf } from '@tenebris/rules/gear';

export { armorTypesFromProf, weaponCategoryNamesFromProf };

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const file = path.join(__dirname, '..', '..', '..', '..', 'packages', 'content', 'content.json');

// Read once when the server starts
const content = JSON.parse(fs.readFileSync(file, 'utf8'));

export const SUBCLASS_LEVEL = 3;

// Pack stores hit_die as "d12"; DB historically used integer sides. Level-up math needs the number.
export function hitDieSides(hitDie) {
    if (hitDie == null || hitDie === '') return null;
    if (typeof hitDie === 'number' && Number.isFinite(hitDie)) return hitDie;
    const m = String(hitDie).match(/(\d+)/);
    if (m) return Number(m[1]);
    const n = Number(hitDie);
    return Number.isFinite(n) ? n : null;
}

export function getRole(roleId) {
    if (roleId == null) return undefined;
    const id = Number(roleId);
    return (content.roles ?? []).find((r) => Number(r.id) === id);
}

export function getCalling(role, callingId) {
    if (!role || callingId == null || callingId === '') return undefined;
    const id = Number(callingId);
    return (role.callings ?? []).find((c) => Number(c.id) === id);
}

// Display names (pack primary_stat) and short codes (pack spell_stat / DB) -> characters table key
const STAT_TO_KEY = {
    might: 'str', str: 'str',
    precision: 'dex', dex: 'dex',
    endurance: 'con', con: 'con',
    intellect: 'int', int: 'int',
    judgment: 'wis', wis: 'wis',
    confidence: 'cha', cha: 'cha',
    speed: 'spd', spd: 'spd',
    luck: 'luc', luc: 'luc',
};

/** 'Might' / 'STR' / 'str' -> 'str' (unknown -> undefined) */
export function scoreKey(stat) {
    if (stat == null || stat === '') return undefined;
    return STAT_TO_KEY[String(stat).trim().toLowerCase()];
}

// Stable feature_choices key (scheme A). The text is decided in @tenebris/rules.
export { choiceKey };

// ----- Starting gear from the pack (not class_item_proficiencies) -----
// armorTypesFromProf and weaponCategoryNamesFromProf live in @tenebris/rules/gear.

function isCommonItem(row) {
    return String(row?.rarity ?? 'common').toLowerCase() === 'common';
}

/** Starting weapons + armor for a role (pack proficiencies + pack catalogs). Same shape as listStartingGear. */

// ----- Divine Blessing (pack) schedule + options; replaces legacy Ability Boost / Primordial Ascent -----
export const DIVINE_BLESSING_NAME = 'Divine Blessing';
export const DIVINE_BLESSING_LEVELS_FALLBACK = [4, 6, 10, 12, 16, 18];
export const KEPT_BOOST = 'Kept boost (already in scores)';

const SCORE_STATS = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];

/** Levels where the pack puts a Divine Blessing marker for this role. */
export function divineBlessingLevelsForRole(role) {
    const levels = [];
    for (const lvl of role?.levels ?? []) {
        if ((lvl.features ?? []).some((f) => f.name === DIVINE_BLESSING_NAME || f.marker === 'divine_blessing')) {
            levels.push(Number(lvl.level));
        }
    }
    return levels.length ? levels : [...DIVINE_BLESSING_LEVELS_FALLBACK];
}

/** Score + blessing option strings for Divine Blessing dropdowns (from pack). */
export function boostOptionStrings({ ascent = false } = {}) {
    const out = [];
    if (ascent) {
        for (const s of SCORE_STATS) out.push(`+1 ${s}`);
    } else {
        for (const s of SCORE_STATS) out.push(`+2 ${s}`);
        for (const b of content.primordial_blessings ?? []) {
            // Blessings that name a score are expanded like the DB class_features.options list
            const name = b.name;
            if (/iron resolve/i.test(name)) {
                for (const s of SCORE_STATS) out.push(`Iron Resolve (+1 ${s})`);
            } else if (/keen wits/i.test(name)) {
                for (const s of ['INT', 'WIS', 'CHA']) out.push(`Keen Wits (+1 ${s})`);
            } else {
                out.push(name);
            }
        }
    }
    out.push(KEPT_BOOST);
    return out;
}

/**
 * Pack-sourced Divine Blessing rows for create step 3 / editor / validation.
 * Keys are scheme A: class:<roleKey>:Divine Blessing:<level>
 * (Pack has no Primordial Ascent.)
 */
export function boostRowsForRole(roleId) {
    const role = getRole(roleId);
    if (!role?.key) return [];
    const options = boostOptionStrings({ ascent: false });
    return divineBlessingLevelsForRole(role).map((level) => {
        const key = choiceKey('class', role.key, DIVINE_BLESSING_NAME, level);
        return {
            id: key,
            key,
            level,
            name: DIVINE_BLESSING_NAME,
            options,
            choice_count: 1,
            source: 'class',
        };
    });
}

/** Pack-sourced blessing rows for prereq checks: [{ name, prerequisite, repeatable_max }] */
export function primordialBlessingsFromPack() {
    return (content.primordial_blessings ?? []).map((b) => ({
        name: b.name,
        prerequisite: b.prerequisite,
        repeatable_max: b.repeatable_max ?? 1,
    }));
}

/** Role armor/weapon proficiency strings for blessing prereqs (pack). */
export function roleProficiencyContext(roleId, callingId = null) {
    const role = getRole(roleId);
    if (!role) return { armor: '', weapons: '', caster: false };
    const calling = getCalling(role, callingId);
    const armor = [role.armor_prof, calling?.armor_prof].filter(Boolean).join(', ');
    const weapons = [role.weapon_prof, calling?.weapon_prof].filter(Boolean).join(', ');
    const casterType = String(role.caster_type ?? 'none').toLowerCase();
    const caster = casterType !== 'none' && casterType !== 'body';
    return { armor, weapons, caster };
}

/** Flatten role (+ calling) feature schedule for description lists (no legacy Fighting Style). */

/** Chart band name for an alignment vs a colour square (from pack alignment_bands). */
export function getAlignmentBand(alignmentCode, colorSquare) {
    if (alignmentCode == null || colorSquare == null) return null;
    const row = (content.alignment_bands ?? []).find(
        (b) => b.alignment_code === alignmentCode && b.color_square === colorSquare
    );
    return row?.band ?? null;
}
export default content;
