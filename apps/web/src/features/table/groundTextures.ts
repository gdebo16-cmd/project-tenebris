// The ground's picture sets (T2). Every surface and every terrain rule has one:
//   photo  : a Poly Haven texture (CC0) in assets/textures/<folder>: color.jpg, normal.jpg (GL), rough.jpg, 1K
//   shader : made in code instead (Gabriel's call: water and ice are custom): waterLookFor / iceLook in boardLooks.ts
// Sources and credits: assets/textures/CREDITS.md. Check them all (and how fast they load): npm run textures:check
import { SURFACES, TERRAIN_KINDS, paintById, type Surface, type TerrainKind } from '@tenebris/rules/board'
import { type TextureQuality } from './graphicsSettings.ts'

export type PhotoSet = { type: 'photo'; folder: string };
export type GroundSet = PhotoSet | { type: 'shader'; shader: 'water' | 'ice' };

export const surfaceSet = (surface: Surface): PhotoSet => {
    const paint = paintById(surface);
    if (paint) return { type: 'photo', folder: paint.folder };
    return { type: 'photo', folder: `surfaces/${surface}` };
};

export const TERRAIN_SETS: Readonly<Record<TerrainKind, GroundSet>> = {
    rough: { type: 'photo', folder: 'terrain/rough' },     // rocky trail
    steep: { type: 'photo', folder: 'terrain/steep' },     // cliff side
    block: { type: 'photo', folder: 'wall' },              // castle wall slates
    deep:  { type: 'shader', shader: 'water' },
    slick: { type: 'shader', shader: 'ice' },
};

export const TEXTURE_MAPS = ['color', 'normal', 'rough'] as const;
export const textureUrl = (folder: string, map: (typeof TEXTURE_MAPS)[number], quality: TextureQuality = '2k') => {
    if (folder.startsWith('library/') && quality === '1k') return `/textures/${folder}/${map}-1k.jpg`;
    return `/textures/${folder}/${map}.jpg`;
};

// Every ground set: the surfaces first, then the terrain rules
export const GROUND_SETS: readonly { name: string; set: GroundSet }[] = [
    ...SURFACES.map((s) => ({ name: s, set: surfaceSet(s) })),
    ...TERRAIN_KINDS.map((t) => ({ name: t, set: TERRAIN_SETS[t] })),
];

// Every picture file the ground uses (what has to load)
export const groundFiles = (): string[] => [...new Set(GROUND_SETS.flatMap(({ set }) =>
    set.type === 'photo' ? TEXTURE_MAPS.map((m) => textureUrl(set.folder, m)) : []))];
