// "What can this character pick?" — every choice the character form may show.
// Pure: the pack and the picks go in, the choices come out. No database, no randomness.
// The server calls it with the real content pack (+ looks.json); tests call it with a tiny fake pack.

// ---- The parts of the content pack this file reads ----

export type PackSpecies = { id: number; key: string; name: string; parent_id: number | null; size_id: number; image: string | null; sort_order?: number };
export type PackSize = { id: number; key: string; name: string };
export type PackCalling = { id: number; key: string; name: string; description?: string | null; img_url?: string | null };
export type PackRole = {
    id: number; key: string; name: string; hit_die: string; primary_stat: string; img_url?: string | null;
    skill_count: number; skill_options: string[]; skill_fixed: string[]; callings?: PackCalling[];
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