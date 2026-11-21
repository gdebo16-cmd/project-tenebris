// The character form's save rules: one check per tab.
// Each check takes what the browser sent (body) and answers either { error } or { values },
// where values are the clean, safe column values to save. The server never saves the body itself.
import { CALLING_LEVEL, checkChoicePicks, type characterOptions, type ChoiceFeature } from './characterOptions.ts';

// What characterOptions() answers: the choices a check compares the body against
export type Options = ReturnType<typeof characterOptions>;

// A column value the form is allowed to save. Arrays are skill lists; the object is feature picks.
type ColumnValue = string | number | null | string[] | Record<string, string[]>;
export type TabResult = { error: string } | { values: Record<string, ColumnValue> };

export const MAX_LEVEL = 30;
export const MAX_NAME_LENGTH = 60;
export const MAX_LOOK_LENGTH = 1000;

// Every tab of the form, in order. A tab without a check yet is refused by the server.
export const FORM_TABS = ['header', 'species', 'role', 'traits', 'personality', 'gear'] as const;
export type FormTab = (typeof FORM_TABS)[number];

type Body = Record<string, unknown> | null | undefined;

// Trimmed text, or '' for anything that isn't text
const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

// ---- Header: name, level, portrait (always visible above the tabs) ----

export function checkHeader(body: Body): TabResult {
    const name = text(body?.name);
    if (!name) return { error: 'Give your character a name' };
    if (name.length > MAX_NAME_LENGTH) return { error: `Names can be at most ${MAX_NAME_LENGTH} characters` };

    const level = Number(body?.level ?? 1);
    if (!Number.isInteger(level) || level < 1 || level > MAX_LEVEL) return { error: `Level must be a whole number from 1 to ${MAX_LEVEL}` };

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

const STAT_COLUMNS = ['str', 'dex', 'con', 'int', 'wis', 'cha', 'luc', 'spd'] as const;

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
