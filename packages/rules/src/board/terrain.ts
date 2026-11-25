import type { GroundLook } from './paint.ts';

export type GroundRule =
    | 'rough'
    | 'steep'
    | 'slick'
    | 'deep';

export type ObjectKind =
    | 'wall'
    | 'thickTree'
    | 'thinTree'
    | 'bush';

export type PlacedObject = {
        kind: ObjectKind;
        // Retain existing per-object data here, such as light settings.
};
    
export type HexCell = {
        ground: {
            look: GroundLook;
            rules: GroundRule[];
        };
        object: PlacedObject | null;
};

export const TERRAIN_KINDS = ['rough', 'deep', 'block', 'slick', 'steep'] as const;

export const isTerrainKind = (value: unknown): value is TerrainKind => TERRAIN_KINDS.includes(value as TerrainKind);

// Terrain nothing can walk into or through. (Water, rough ground and ice will cost extra movement later; not decided yet.)
export const BLOCKING_TERRAIN: readonly TerrainKind[] = ['block'];
export type TerrainKind = (typeof TERRAIN_KINDS)[number];

export const FEATURE_KINDS = ['light', 'brazier', 'tree', 'bush', 'boulder', 'pillar', 'crate', 'barrel', 'rubble'] as const;
export type FeatureKind = (typeof FEATURE_KINDS)[number];
export const isFeatureKind = (value: unknown): value is FeatureKind => FEATURE_KINDS.includes(value as FeatureKind);
export type Feature = { kind: FeatureKind; size?: number; color?: string };   // size: 0.5–2 (1 = normal); color: '#rrggbb'
export const BLOCKING_FEATURES: readonly FeatureKind[] = ['tree', 'boulder', 'pillar'];
export const LIGHT_FEATURES: readonly FeatureKind[] = ['light', 'brazier'];
export const MAX_LIGHTS = 8;

// A scene's terrain map ({ "2,0": "wall", ... }) and features -> the hexKeys that block movement, ready for findPath
export function wallsOf(terrain: Record<string, string>, features: Record<string, Feature> = {}): Set<string> {
    const walls = Object.keys(terrain).filter((key) => BLOCKING_TERRAIN.includes(terrain[key] as TerrainKind));
    const blockers = Object.keys(features).filter((key) => BLOCKING_FEATURES.includes(features[key]?.kind));
    return new Set([...walls, ...blockers]);
}

