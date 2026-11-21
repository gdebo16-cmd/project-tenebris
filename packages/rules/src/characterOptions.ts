// "What can this character pick?" — every choice the character form may show.
// Pure: the pack and the picks go in, the choices come out. No database, no randomness.
// The server calls it with the real content pack (+ looks.json); tests call it with a tiny fake pack.

// ---- The parts of the content pack this file reads ----

export type PackSpecies = { id: number; key: string; name: string; parent_id: number | null; size_id: number; image: string | null; sort_order?: number };
export type PackSize = { id: number; key: string; name: string };
// A create-time pick on a role or calling (Preferred Arms, a calling feature, …)
export type PackChoiceFeature = {
    name: string;
    level?: number;
    options?: string[];
    choice_count?: number;
    option_info?: Record<string, string>;
    data?: { choice_timing?: string } | null;
};
export type PackCalling = {
    id: number; key: string; name: string; description?: string | null; img_url?: string | null;
    features?: PackChoiceFeature[];
};
export type PackRole = {
    id: number; key: string; name: string; hit_die: string; primary_stat: string; img_url?: string | null;
    skill_count: number; skill_options: string[]; skill_fixed: string[]; callings?: PackCalling[];
    levels?: { level: number; features?: PackChoiceFeature[] }[];
};
export type PackGift = { id: number; name: string; tree?: string | null; prerequisite?: string | null; description?: string | null };
export type PackAlignment = { code: string; name: string; law_axis: number; good_axis: number; sort?: number };
export type PackPersonality = { id: number; category: string; name: string; flavor?: string | null; perk?: string | null; sort?: number };

// packages/content/looks.json: eye colors, plus each species' sizes and variant colors (by species key)
export type Looks = { eye_colors: string[]; species: Record<string, { size_ids?: number[]; variants?: string[] }> };

export type OptionsPack = {
    species: PackSpecies[];
    sizes: PackSize[];
    roles: PackRole[];
    primordial_blessings: PackGift[];   // shown to players as "gifts"
    alignments: PackAlignment[];
    personality_options: PackPersonality[];
    looks: Looks;
};

// What the player has picked so far. Anything missing just means "not picked yet".
export type Picks = {
    level: number;
    species_id?: number;
    role_id?: number;
    calling_id?: number;
};

// ---- Small rules, each one testable on its own ----

// Callings open at level 3 (SUBCLASS_LEVEL on the server today)
export const CALLING_LEVEL = 3;

// Players can't pick a size bigger than this
export const LARGEST_PLAYER_SIZE = 'large';

// How many gifts a character may choose at a level.
// PLACEHOLDER from the guide (1, +1 at level 4, +1 at level 8) until the owner decides in docs/DECISIONS.md.
export function giftsAllowed(level: number): number {
    return 1 + (level >= 4 ? 1 : 0) + (level >= 8 ? 1 : 0);
}

// The sizes a species may choose: its looks.json list (or just its own size), never above Large
export function sizeOptions(species: PackSpecies, looks: Looks, sizes: PackSize[]): PackSize[] {
    const largest = sizes.find((s) => s.key === LARGEST_PLAYER_SIZE)?.id ?? Infinity;
    const allowed = looks.species[species.key]?.size_ids ?? [species.size_id];
    return sizes.filter((s) => allowed.includes(s.id) && s.id <= largest);
}

const bySort = <T extends { sort_order?: number; sort?: number }>(a: T, b: T) =>
    (a.sort_order ?? a.sort ?? 0) - (b.sort_order ?? b.sort ?? 0);

// ---- Feature choices (the picks a role or calling asks for at creation) ----

// The key stored in characters.feature_choices. Same text the old editor already uses.
export function choiceKey(source: string, ownerKey: string, featureName: string, level: number): string {
    return `${source}:${ownerKey}:${featureName}:${level}`;
}

export type ChoiceFeature = {
    key: string;
    name: string;
    level: number;
    choose: number;
    options: string[];
    source: 'class' | 'subclass';
    optionInfo: Record<string, string>;
};

// Top-level options are only present for create-time features. Anything else is not a picker.
function isCreateChoice(feature: PackChoiceFeature): boolean {
    if (!Array.isArray(feature.options) || feature.options.length === 0) return false;
    const timing = feature.data?.choice_timing;
    return timing == null || timing === 'create';
}

// The pickers this role (and calling, from level 3) shows at this level.
export function choiceFeaturesFor(role: PackRole | null | undefined, callingId: number | undefined, level: number): ChoiceFeature[] {
    if (!role?.key) return [];
    const rows: ChoiceFeature[] = [];
    for (const step of role.levels ?? []) {
        if (step.level > level) continue;
        for (const feature of step.features ?? []) {
            if (!isCreateChoice(feature)) continue;
            rows.push({
                key: choiceKey('class', role.key, feature.name, step.level),
                name: feature.name,
                level: step.level,
                choose: feature.choice_count ?? 1,
                options: feature.options ?? [],
                source: 'class',
                optionInfo: feature.option_info ?? {},
            });
        }
    }
    if (callingId != null && level >= CALLING_LEVEL) {
        const calling = role.callings?.find((item) => item.id === callingId);
        for (const feature of calling?.features ?? []) {
            const featureLevel = feature.level ?? 1;
            if (featureLevel > level || !isCreateChoice(feature) || !calling?.key) continue;
            rows.push({
                key: choiceKey('subclass', calling.key, feature.name, featureLevel),
                name: feature.name,
                level: featureLevel,
                choose: feature.choice_count ?? 1,
                options: feature.options ?? [],
                source: 'subclass',
                optionInfo: feature.option_info ?? {},
            });
        }
    }
    return rows.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
}

// These rows share a pool of options, so picking the same option twice is fine.
const REPEATABLE = new Set(['Divine Blessing', 'Ability Boost', 'Primordial Ascent']);

// Checks the picks the browser sent. Missing pickers are allowed; a wrong pick is not.
export function checkChoicePicks(features: ChoiceFeature[], picks: unknown, level = Infinity): { error: string } | { choices: Record<string, string[]> } {
    if (picks == null) return { choices: {} };
    if (typeof picks !== 'object' || Array.isArray(picks)) return { error: 'feature_choices must be an object' };
    const byKey = new Map(features.map((feature) => [feature.key, feature]));
    const choices: Record<string, string[]> = {};
    for (const [key, raw] of Object.entries(picks)) {
        const values = (Array.isArray(raw) ? raw : [raw]).filter((value) => value !== '' && value != null);
        if (values.length === 0) continue;
        const feature = byKey.get(key);
        if (!feature) return { error: 'One of those feature choices is not part of this class or subclass' };
        if (feature.level > level) return { error: `${feature.name} unlocks at level ${feature.level}` };
        if (values.length !== feature.choose) return { error: `Pick exactly ${feature.choose} for ${feature.name}` };
        if (!values.every((value) => typeof value === 'string' && feature.options.includes(value))) {
            return { error: `That is not an option for ${feature.name}` };
        }
        if (new Set(values).size !== values.length) return { error: 'Each option can only be picked once' };
        choices[key] = values as string[];
    }
    const seen = new Map<string, Set<string>>();
    for (const [key, values] of Object.entries(choices)) {
        const feature = byKey.get(key)!;
        if (REPEATABLE.has(feature.name)) continue;
        const pool = `${feature.source}:${feature.name}`;
        const taken = seen.get(pool) ?? new Set<string>();
        for (const value of values) {
            if (taken.has(value)) return { error: `You already picked ${value} from ${feature.name}` };
            taken.add(value);
        }
        seen.set(pool, taken);
    }
    return { choices };
}

// ---- The answer ----

export function characterOptions(pack: OptionsPack, picks: Picks) {
    const role = pack.roles.find((r) => r.id === picks.role_id);
    const personality = (category: string) =>
        pack.personality_options.filter((p) => p.category === category).sort(bySort)
            .map((p) => ({ id: p.id, name: p.name, flavor: p.flavor ?? null, perk: p.perk ?? null }));

    return {
        // Top-level species. A species with sub-species lists them; one without lists its variant colors.
        species: pack.species.filter((s) => s.parent_id == null).sort(bySort).map((s) => {
            const subspecies = pack.species.filter((sub) => sub.parent_id === s.id).sort(bySort)
                .map((sub) => ({ id: sub.id, name: sub.name, image: sub.image }));
            return {
                id: s.id,
                key: s.key,
                name: s.name,
                image: s.image,
                sizes: sizeOptions(s, pack.looks, pack.sizes).map((z) => ({ id: z.id, name: z.name })),
                subspecies,
                variants: subspecies.length > 0 ? [] : (pack.looks.species[s.key]?.variants ?? []),
            };
        }),

            eyeColors: pack.looks.eye_colors,

            roles: pack.roles.map((r) => ({ id: r.id, key: r.key, name: r.name, hit_die: r.hit_die, primary_stat: r.primary_stat, image: r.img_url ?? null })),

            // Only the picked role's callings, and only from level 3
            callings: role && picks.level >= CALLING_LEVEL
            ? (role.callings ?? []).map((c) => ({ id: c.id, key: c.key, name: c.name, description: c.description ?? null, image: c.img_url ?? null }))
            : [],

        // Skills come from the role, so there's nothing to show until one is picked
        skills: role ? { choose: role.skill_count, from: role.skill_options, fixed: role.skill_fixed } : null,

        // Pickers unlocked at this level, for this role and calling
        features: choiceFeaturesFor(role, picks.calling_id, picks.level),

        gifts: {
            choose: giftsAllowed(picks.level),
            from: pack.primordial_blessings.map((g) => ({ id: g.id, name: g.name, tree: g.tree ?? null, prerequisite: g.prerequisite ?? null, description: g.description ?? null })),
        },

        alignments: [...pack.alignments].sort(bySort).map((a) => ({ code: a.code, name: a.name, law_axis: a.law_axis, good_axis: a.good_axis })),
        upbringings: personality('upbringing'),
        lifestyles: personality('lifestyle'),
        outlooks: personality('outlook'),
    };
}