export type GroundLook =
    | 'grass'
    | 'dirt'
    | 'stone'
    | 'ice'
    | 'water'
    | 'sand'
    | 'snow'
    | 'mud'
    | 'cobble'
    | 'flagstone'
    | 'bricks'
    | 'bark';

export const SURFACES = ['grass', 'moss', 'dirt', 'cobble', 'flagstone', 'rock', 'bricks', 'snow', 'bark', 'woodfloor', 'roof'] as const;
export type Surface = (typeof SURFACES)[number];
export const DEFAULT_SURFACE: Surface = 'grass';
export const isSurface = (value: unknown): value is Surface => SURFACES.includes(value as Surface);