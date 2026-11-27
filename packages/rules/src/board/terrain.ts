import { type Hex, hexKey, neighbors, onBoard } from './hex.ts';
import { type Surface, DEFAULT_SURFACE, isSurface } from './paint.ts';

// The ground rules (T0): how the ground itself treats a token. ('block' in TERRAIN_KINDS isn't one: a block hex is a
// wall, and a wall is an object; see OBJECT_RULES below.)
export const GROUND_RULES = ['rough', 'steep', 'slick', 'deep'] as const;
export type GroundRule = (typeof GROUND_RULES)[number];
export const isGroundRule = (value: unknown): value is GroundRule => GROUND_RULES.includes(value as GroundRule);

export const TERRAIN_KINDS = ['rough', 'deep', 'block', 'slick', 'steep'] as const;

export const isTerrainKind = (value: unknown): value is TerrainKind => TERRAIN_KINDS.includes(value as TerrainKind);

// Terrain nothing can walk into or through. (Water, rough ground and ice will cost extra movement later; not decided yet.)
export const BLOCKING_TERRAIN: readonly TerrainKind[] = ['block'];
export type TerrainKind = (typeof TERRAIN_KINDS)[number];

export const FEATURE_KINDS = ['light', 'brazier', 'tree', 'bush', 'boulder', 'pillar', 'crate', 'barrel', 'rubble', 'thinTree'] as const;   // tree = a thick tree
export type FeatureKind = (typeof FEATURE_KINDS)[number];
export const isFeatureKind = (value: unknown): value is FeatureKind => FEATURE_KINDS.includes(value as FeatureKind);
export type Feature = { kind: FeatureKind; size?: number; color?: string };   // size: 0.5–2 (1 = normal); color: '#rrggbb'
export const BLOCKING_FEATURES: readonly FeatureKind[] = ['tree', 'boulder', 'pillar'];
export const LIGHT_FEATURES: readonly FeatureKind[] = ['light', 'brazier'];
export const MAX_LIGHTS = 8;

// A scene's terrain map ({ "2,0": "wall", ... }) and features -> the hexKeys that block movement, ready for findPath
export function wallsOf(terrain: Record<string, string>, features: Record<string, Feature> = {}): Set<string> {
    const rules = upgradeTerrain(terrain);              // an old board's 'wall' still blocks
    const walls = Object.keys(rules).filter((key) => BLOCKING_TERRAIN.includes(rules[key] as TerrainKind));
    const blockers = Object.keys(features).filter((key) => BLOCKING_FEATURES.includes(features[key]?.kind));
    return new Set([...walls, ...blockers]);
}

// ---- T0: one terrain model ----
// A hex has three layers, each saved in its own place on the scene:
//   ground look  (scene.surfaces): grass, cobble, snow...: how it looks, nothing more
//   ground rules (scene.terrain) : rough, slick, deep (water), steep. Steep also comes on its own from heights: stepping
//                                  up STEEP_RISE levels or more is steep, painted or not.
//   objects      (scene.features): trees, bushes, crates... A 'block' hex in scene.terrain is a wall: an object too.
// They stack: a wall with a light on it, rough ground under a bush. cellAt puts the three together for one hex.

// Old boards saved the rules under their first names. Each still means the same thing under its new one.
export const LEGACY_TERRAIN: Readonly<Partial<Record<string, TerrainKind>>> = { wall: 'block', water: 'deep', ice: 'slick' };

// An old board's rules under today's names. Every hex is kept: old names are renamed, today's pass through, and a name
// nobody knows stays exactly as it was (never dropped). Running it twice changes nothing.
export function upgradeTerrain(terrain: Record<string, string> | null | undefined): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [key, kind] of Object.entries(terrain ?? {})) out[key] = LEGACY_TERRAIN[kind] ?? kind;
    return out;
}

// A board as the server keeps it (heights live in the look)
export type Board = {
    terrain?: Record<string, string> | null;
    surfaces?: Record<string, string> | null;
    features?: Record<string, Feature> | null;
    heights?: Record<string, number> | null;
};

export const OBJECT_KINDS = ['wall', ...FEATURE_KINDS] as const;
export type ObjectKind = (typeof OBJECT_KINDS)[number];
export type PlacedObject = { kind: ObjectKind; size?: number; color?: string };   // keeps a feature's own settings (light colour...)

// What an object does to a token walking into its hex:
//   block: can't go in (or see through): walls, thick trees, boulders, pillars. The same as BLOCKING_FEATURES.
//   climb: a short prop, climbed over for CLIMB_COST more movement (Gabriel, 2026-11-25)
//   rough: underbrush and rubble, ROUGH_COST more, like rough ground
//   none : nothing (a light)
export type ObjectRule = 'block' | 'climb' | 'rough' | 'none';
export const OBJECT_RULES: Readonly<Record<ObjectKind, ObjectRule>> = {
    wall: 'block', tree: 'block', boulder: 'block', pillar: 'block',
    thinTree: 'rough', bush: 'rough', rubble: 'rough',
    crate: 'climb', barrel: 'climb', brazier: 'climb',
    light: 'none',
};
export const ROUGH_COST = 1;      // rough: +1 movement (Gabriel, 2026-11-25)
export const CLIMB_COST = 2;      // climbing (steep ground, short props): +2
export const STEEP_RISE = 2;      // stepping up this many height levels (5 ft each) or more is steep

export type HexCell = {
    ground: { look: Surface; rules: GroundRule[] };
    objects: PlacedObject[];
    height: number;
};

// Everything on one hex. cameFrom: the hex a token steps in from (steep depends on which way you go).
export function cellAt(board: Board, key: string, cameFrom?: string): HexCell {
    const raw = board.terrain?.[key];
    const kind = raw === undefined ? undefined : (LEGACY_TERRAIN[raw] ?? raw);
    const rules: GroundRule[] = isGroundRule(kind) ? [kind] : [];
    const height = board.heights?.[key] ?? 0;
    if (cameFrom !== undefined && !rules.includes('steep') && height - (board.heights?.[cameFrom] ?? 0) >= STEEP_RISE) rules.push('steep');
    const objects: PlacedObject[] = [];
    if (kind === 'block') objects.push({ kind: 'wall' });
    const feature = board.features?.[key];
    if (feature && isFeatureKind(feature.kind)) objects.push({ ...feature });
    const look = board.surfaces?.[key];
    return { ground: { look: isSurface(look) ? look : DEFAULT_SURFACE, rules }, objects, height };
}

export type Walker = { swims?: boolean; radius?: number };   // swims: has a swim speed. radius: stay on a board this size

// What one step costs, in hexes of movement, or null when the hex can't be entered.
// Deep water: a token without a swim speed has its walk halved there (each hex costs 2); with one it swims at full pace.
// Slick costs nothing extra: ice is a Balance roll (sliding 1 hex on a fail), which comes with the Balance prompts.
export function stepCost(board: Board, from: string, to: string, walker: Walker = {}): number | null {
    const cell = cellAt(board, to, from);
    const objectRules = cell.objects.map((o) => OBJECT_RULES[o.kind]);
    if (objectRules.includes('block')) return null;
    const rules = cell.ground.rules;
    let cost = rules.includes('deep') && !walker.swims ? 2 : 1;
    if (rules.includes('rough') || objectRules.includes('rough')) cost += ROUGH_COST;
    if (rules.includes('steep') || objectRules.includes('climb')) cost += CLIMB_COST;
    return cost;
}

// A walk: the hexes in order (start first), what it cost, and the slick and deep-water hexes it went through
export type Walk = { path: Hex[]; cost: number; slick: string[]; deep: string[] };

// The cheapest walk from start to goal that costs no more than budget (hexes of movement), or null.
export function findWalk(start: Hex, goal: Hex, board: Board, budget: number, walker: Walker = {}): Walk | null {
    const startKey = hexKey(start), goalKey = hexKey(goal);
    const best = new Map<string, number>([[startKey, 0]]);
    const cameFrom = new Map<string, Hex | null>([[startKey, null]]);
    const buckets: Hex[][] = [[start]];                 // buckets[c]: hexes reached for c movement (steps cost 1 to 4)
    for (let c = 0; c < buckets.length; c++) {
        for (const hex of buckets[c] ?? []) {
            const key = hexKey(hex);
            if (best.get(key) !== c) continue;          // reached more cheaply since
            if (key === goalKey) return walkTo(goal, c, cameFrom, board);
            for (const next of neighbors(hex)) {
                if (walker.radius !== undefined && !onBoard(next, walker.radius)) continue;
                const nextKey = hexKey(next);
                const step = stepCost(board, key, nextKey, walker);
                if (step === null) continue;
                const total = c + step;
                if (total > budget || total >= (best.get(nextKey) ?? Infinity)) continue;
                best.set(nextKey, total);
                cameFrom.set(nextKey, hex);
                (buckets[total] ??= []).push(next);
            }
        }
    }
    return null;
}

function walkTo(goal: Hex, cost: number, cameFrom: Map<string, Hex | null>, board: Board): Walk {
    const path: Hex[] = [];
    for (let step: Hex | null = goal; step; step = cameFrom.get(hexKey(step)) ?? null) path.push(step);
    path.reverse();
    const crossed = path.slice(1).map(hexKey);
    const has = (rule: GroundRule) => crossed.filter((key) => cellAt(board, key).ground.rules.includes(rule));
    return { path, cost, slick: has('slick'), deep: has('deep') };
}

