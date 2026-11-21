// The character form's save rules: one check per tab.
// Each check takes what the browser sent (body) and answers either { error } or { values },
// where values are the clean, safe column values to save. The server never saves the body itself.
import { CALLING_LEVEL, checkChoicePicks, type characterOptions, type ChoiceFeature } from './characterOptions.ts';

// What characterOptions() answers: the choices a check compares the body against
export type Options = ReturnType<typeof characterOptions>;

// A column value the form is allowed to save.
type ColumnValue = string | number | null | string[] | Record<string, string[]> | StatRollState;
export type TabResult = { error: string } | { values: Record<string, ColumnValue> };

export const MAX_LEVEL = 20;
export const MAX_NAME_LENGTH = 60;
export const MAX_LOOK_LENGTH = 1000;

// Every tab of the form, in order. A tab without a check yet is refused by the server.
export const FORM_TABS = ['header', 'species', 'role', 'traits', 'personality', 'gear'] as const;
export type FormTab = (typeof FORM_TABS)[number];

type Body = Record<string, unknown> | null | undefined;

// Trimmed text, or '' for anything that isn't text
const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

// ---- Header: name, level, portrait (always visible above the tabs) ----

// 1 through MAX_LEVEL, plus the character's own level when that is already above the cap.
// Those characters keep their level. They can drop to the cap or below. They cannot be raised.
export function levelChoices(currentLevel: number | null | undefined): number[] {
    const choices: number[] = [];
    for (let n = 1; n <= MAX_LEVEL; n++) choices.push(n);
    const current = Number(currentLevel);
    if (Number.isInteger(current) && current > MAX_LEVEL) choices.push(current);
    return choices;
}

export function checkHeader(body: Body, currentLevel?: number | null): TabResult {
    const name = text(body?.name);
    if (!name) return { error: 'Give your character a name' };
    if (name.length > MAX_NAME_LENGTH) return { error: `Names can be at most ${MAX_NAME_LENGTH} characters` };

    const level = Number(body?.level ?? 1);
    const kept = Number.isInteger(Number(currentLevel)) && level === Number(currentLevel) && level > MAX_LEVEL;
    if (!Number.isInteger(level) || level < 1 || (level > MAX_LEVEL && !kept)) {
        return { error: `Level must be a whole number from 1 to ${MAX_LEVEL}` };
    }

    // Portraits are pictures the site already has, so they're paths like /portraits/a.png
    const portrait = text(body?.portrait_url);
    if (portrait && (!portrait.startsWith('/') || portrait.length > 300)) return { error: 'Pick a portrait from the list' };

    return { values: { name, level, portrait_url: portrait || null } };
}

// ---- Species & look ----

export function checkSpeciesTab(options: Options, body: Body): TabResult {
    const species = options.species.find((s) => s.id === Number(body?.species_id));
    if (!species) return { error: 'Pick a species' };

    const sizeId = Number(body?.size_id);
    if (!species.sizes.some((z) => z.id === sizeId)) return { error: 'That size is not allowed for this species' };

    // A species with sub-species saves the sub-species' id (that's how the sheet finds it);
    // one without sub-species saves its own id plus a variant color.
    let speciesId: number = species.id;
    let variant: string | null = null;
    if (species.subspecies.length > 0) {
        const sub = species.subspecies.find((s) => s.id === Number(body?.subspecies_id));
        if (!sub) return { error: `Pick a kind of ${species.name}` };
        speciesId = sub.id;
    } else if (species.variants.length > 0) {
        variant = text(body?.variant);
        if (!species.variants.includes(variant)) return { error: 'Pick a variant' };
    }

    const eyeColor = text(body?.eye_color);
    if (!options.eyeColors.includes(eyeColor)) return { error: 'Pick an eye color' };

    const look = text(body?.look_description);
    if (look.length > MAX_LOOK_LENGTH) return { error: `The look description can be at most ${MAX_LOOK_LENGTH} characters` };

    return { values: { species_id: speciesId, size_id: sizeId, variant, eye_color: eyeColor, look_description: look || null } };
}

// ---- Role & calling ----

// Below level 3 a character has no calling, and its calling picks are dropped. Role picks stay.
export function clearedCalling(featureChoices: unknown): { calling_id: null; feature_choices: Record<string, string[]> } {
    const kept: Record<string, string[]> = {};
    if (featureChoices && typeof featureChoices === 'object' && !Array.isArray(featureChoices)) {
        for (const [key, value] of Object.entries(featureChoices)) {
            if (key.startsWith('subclass:')) continue;
            if (!Array.isArray(value)) continue;
            const texts = value.filter((item): item is string => typeof item === 'string');
            if (texts.length > 0) kept[key] = texts;
        }
    }
    return { calling_id: null, feature_choices: kept };
}

// A role-tab save replaces this role's pickers. Picks that belong to something else (a Divine Blessing
// on the same role) stay. Changing role drops the old role's picks.
export function keepUnrelatedChoices(saved: unknown, next: Record<string, string[]>, features: ChoiceFeature[], roleChanged: boolean): Record<string, string[]> {
    if (roleChanged) return next;
    const owned = new Set(features.map((feature) => feature.key));
    const out: Record<string, string[]> = { ...next };
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return out;
    for (const [key, value] of Object.entries(saved)) {
        if (owned.has(key) || key.startsWith('subclass:')) continue;
        if (!Array.isArray(value) || key in out) continue;
        const texts = value.filter((item): item is string => typeof item === 'string');
        if (texts.length > 0) out[key] = texts;
    }
    return out;
}

export function checkRoleTab(options: Options, body: Body): TabResult {
    const role = options.roles.find((item) => item.id === Number(body?.role_id));
    if (!role) return { error: 'Pick a role' };

    const rawCalling = body?.calling_id;
    const sentCalling = rawCalling == null || rawCalling === '' ? null : Number(rawCalling);
    if (sentCalling != null && !Number.isInteger(sentCalling)) return { error: 'Pick a calling from the list' };
    if (sentCalling != null && !options.callings.some((item) => item.id === sentCalling)) {
        // No callings in the list means the level is too low. A wrong id means it isn't this role's.
        return { error: options.callings.length === 0 ? `Callings unlock at level ${CALLING_LEVEL}` : 'That calling is not part of this role' };
    }

    const skills = options.skills;
    if (!skills) return { error: 'Pick a role' };
    const chosen = Array.isArray(body?.skills) ? body.skills : [];
    if (chosen.length !== skills.choose) return { error: `Pick exactly ${skills.choose} skill${skills.choose === 1 ? '' : 's'}` };
    if (!chosen.every((skill) => typeof skill === 'string' && skills.from.includes(skill))) {
        return { error: 'One of those skills is not an option for this role' };
    }
    if (new Set(chosen).size !== chosen.length) return { error: 'Each skill can only be picked once' };
    if (chosen.some((skill) => skills.fixed.includes(skill))) return { error: 'That skill is already given by your role' };

    const picked = checkChoicePicks(options.features, body?.feature_choices);
    if ('error' in picked) return { error: picked.error };

    return {
        values: {
            role_id: role.id,
            calling_id: sentCalling,
            skill_proficiencies: [...skills.fixed, ...chosen],
            feature_choices: picked.choices,
        },
    };
}

// ---- Finishing ----

// The saved fields finishing looks at
export type FinishFields = {
    name?: string | null; level?: number | null; species_id?: number | null; size_id?: number | null; eye_color?: string | null;
    role_id?: number | null;
    str?: number | null; dex?: number | null; con?: number | null; int?: number | null;
    wis?: number | null; cha?: number | null; luc?: number | null; spd?: number | null;
};

export const STAT_COLUMNS = ['str', 'dex', 'con', 'int', 'wis', 'cha', 'luc', 'spd'] as const;
export type StatName = (typeof STAT_COLUMNS)[number];

// One 4d6-drop-lowest result, as the server stored it. total is dice minus the dropped die.
export type OneRoll = { rolls: number[]; dropped: number; total: number };

// stat_rolls on the character: the 8 rolls, which stat each one was placed on, and the gift ids.
export type StatRollState = {
    rolls: (OneRoll | null)[];
    placement: Partial<Record<StatName, number>>;
    gifts: number[];
};

export const ROLL_COUNT = 8;

export function emptyStatRolls(): StatRollState {
    return { rolls: Array.from({ length: ROLL_COUNT }, () => null), placement: {}, gifts: [] };
}

function oneRoll(value: unknown): OneRoll | null {
    if (!value || typeof value !== 'object') return null;
    const row = value as Record<string, unknown>;
    if (!Array.isArray(row.rolls) || row.rolls.length !== 4) return null;
    if (!row.rolls.every((die) => Number.isInteger(die) && Number(die) >= 1 && Number(die) <= 6)) return null;
    const dropped = Number(row.dropped);
    if (!Number.isInteger(dropped)) return null;
    const rolls = row.rolls.map(Number);
    // Trust the dice, not a total that might have been edited in the database.
    return { rolls, dropped, total: rolls.reduce((sum, die) => sum + die, 0) - dropped };
}

// Anything that isn't a saved roll state becomes 8 empty slots.
export function readStatRolls(raw: unknown): StatRollState {
    const empty = emptyStatRolls();
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return empty;
    const src = raw as Record<string, unknown>;
    const rolls = Array.isArray(src.rolls) ? src.rolls : [];
    for (let i = 0; i < ROLL_COUNT; i++) empty.rolls[i] = oneRoll(rolls[i]);
    if (src.placement && typeof src.placement === 'object' && !Array.isArray(src.placement)) {
        for (const stat of STAT_COLUMNS) {
            const index = Number((src.placement as Record<string, unknown>)[stat]);
            if (Number.isInteger(index)) empty.placement[stat] = index;
        }
    }
    if (Array.isArray(src.gifts)) empty.gifts = src.gifts.map(Number).filter((id) => Number.isInteger(id));
    return empty;
}

export function writeRoll(state: StatRollState, index: number, rolled: { rolls: number[]; dropped: number; total: number }): StatRollState {
    const rolls = state.rolls.slice();
    rolls[index] = { rolls: rolled.rolls, dropped: rolled.dropped, total: rolled.total };
    return { ...state, rolls };
}

// The stored roll, plus +2 and/or +1 when this stat was picked for a bonus. Same stat may take both.
export function scoreFromRolls(state: StatRollState, stat: StatName, plus2: string | null, plus1: string | null): number | null {
    const index = state.placement[stat];
    if (index == null) return null;
    const roll = state.rolls[index];
    if (!roll) return null;
    return roll.total + (stat === plus2 ? 2 : 0) + (stat === plus1 ? 1 : 0);
}

// PLACEHOLDER until docs/DECISIONS.md: rerolls are unlimited on a draft and refused after finish.
export function rerollAllowed(isDraft: boolean): { error: string } | { ok: true } {
    if (!isDraft) return { error: 'Rolls are locked once a character is finished' };
    return { ok: true };
}

export function checkStatRollBody(body: Body): { error: string } | { index: number } | { reset: 'placements' | 'rolls' } {
    if (!body || typeof body !== 'object') return { error: 'Say which roll to make' };
    if (body.reset === 'placements' || body.reset === 'rolls') {
        if (body.index !== undefined) return { error: 'Send a roll or a reset, not both' };
        return { reset: body.reset };
    }
    const index = Number(body.index);
    if (!Number.isInteger(index) || index < 0 || index >= ROLL_COUNT) return { error: 'Roll index must be 0 to 7' };
    return { index };
}

function giftIds(body: Body): number[] {
    const raw = body?.gifts;
    if (raw == null) return [];
    if (!Array.isArray(raw)) return [];
    return raw.map(Number);
}

export function checkTraitsTab(options: Options, stored: unknown, body: Body): TabResult {
    const state = readStatRolls(stored);
    const placement = body?.placement;
    if (!placement || typeof placement !== 'object' || Array.isArray(placement)) return { error: 'Place each roll on a stat' };

    const used = new Set<number>();
    const placed: Partial<Record<StatName, number>> = {};
    const scores: Record<StatName, number> = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0, luc: 0, spd: 0 };
    for (const stat of STAT_COLUMNS) {
        const index = Number((placement as Record<string, unknown>)[stat]);
        if (!Number.isInteger(index) || index < 0 || index >= ROLL_COUNT) return { error: `Place a roll on ${stat}` };
        if (used.has(index)) return { error: 'Each roll can only go to one stat' };
        const roll = state.rolls[index];
        if (!roll) return { error: 'That roll has not been made yet' };
        used.add(index);
        placed[stat] = index;
        scores[stat] = roll.total;
    }

    const plus2 = text(body?.plus2);
    const plus1 = text(body?.plus1);
    if (!(STAT_COLUMNS as readonly string[]).includes(plus2)) return { error: 'Pick a stat for the +2' };
    if (!(STAT_COLUMNS as readonly string[]).includes(plus1)) return { error: 'Pick a stat for the +1' };
    // Same stat is allowed: both bonuses add.
    scores[plus2 as StatName] += 2;
    scores[plus1 as StatName] += 1;

    if (body?.gifts != null && !Array.isArray(body.gifts)) return { error: 'Pick gifts from the list' };
    const gifts = giftIds(body);
    if (gifts.some((id) => !Number.isInteger(id))) return { error: 'Pick gifts from the list' };
    if (new Set(gifts).size !== gifts.length) return { error: 'Each gift can only be picked once' };
    const allowed = new Set(options.gifts.from.map((gift) => gift.id));
    if (gifts.some((id) => !allowed.has(id))) return { error: 'That gift is not on the list' };
    if (gifts.length > options.gifts.choose) return { error: `Choose at most ${options.gifts.choose} gift${options.gifts.choose === 1 ? '' : 's'}` };

    return {
        values: {
            ...scores,
            plus2_stat: plus2,
            plus1_stat: plus1,
            stat_rolls: { rolls: state.rolls, placement: placed, gifts },
        },
    };
}

// ---- Personality ----

// Each pick gives one magic state. The database refuses the row when two states match,
// so this check says so first, instead of letting the save crash.
const PERSONALITY = [
    { key: 'upbringing', list: 'upbringings', label: 'upbringing' },
    { key: 'lifestyle', list: 'lifestyles', label: 'lifestyle' },
    { key: 'outlook', list: 'outlooks', label: 'outlook' },
] as const;

export function checkPersonalityTab(options: Options, body: Body): TabResult {
    const code = text(body?.alignment_code);
    if (!options.alignments.some((item) => item.code === code)) return { error: 'Pick an alignment' };

    const values: Record<string, string | number | null> = { alignment_code: code };
    const states: string[] = [];
    for (const cat of PERSONALITY) {
        const id = Number(body?.[`${cat.key}_id`]);
        const picked = options[cat.list].find((item) => item.id === id);
        if (!picked) return { error: `Pick an ${cat.label}` };
        // A normal pick's state comes from the pack. Only a wildcard pick uses the state the browser sent.
        const state = picked.any_state ? text(body?.[`${cat.key}_state`]).toLowerCase() : String(picked.state ?? '').toLowerCase();
        if (picked.any_state && !options.states.includes(state)) return { error: `Pick a state for ${picked.name}` };
        if (!state) return { error: `Pick an ${cat.label}` };
        states.push(state);
        values[`${cat.key}_id`] = picked.id;
        values[`${cat.key}_state`] = state;
    }
    if (new Set(states).size !== 3) return { error: 'Upbringing, lifestyle and outlook must give 3 different states' };
    return { values };
}

// What still stops this character from being finished, one line per tab. Empty = ready.
export function missingForFinish(ch: FinishFields): string[] {
    const missing: string[] = [];
    if (!ch.name) missing.push('Header: a name');
    if (!ch.species_id || !ch.size_id || !ch.eye_color) missing.push('Species & look: species, size and eye color');
    if (!ch.role_id) missing.push('Role & calling: a role');
    if (STAT_COLUMNS.some((stat) => ch[stat] == null)) missing.push('Traits & gifts: place all 8 stat rolls');
    return missing;
}

// Starting HP: the server's hit-die roll + CON mod, plus (hit die / 2 + 1 + CON mod, at least 1) per level after the first.
// Same formula as the old creator. Never below 1.
export function startingHp(hitDieSides: number, con: number, level: number, firstRoll: number): number {
    const conMod = Math.floor(con / 2) - 5;
    const perLevel = Math.max(1, Math.floor(hitDieSides / 2) + 1 + conMod);
    return Math.max(1, firstRoll + conMod + (level - 1) * perLevel);
}
