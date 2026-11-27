import { isLibraryPaint } from './paintLibrary.ts';

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
export type CoreSurface = (typeof SURFACES)[number];
export type Surface = CoreSurface | string;
export const DEFAULT_SURFACE: Surface = 'grass';
export const isCoreSurface = (value: unknown): value is CoreSurface => typeof value === 'string' && (SURFACES as readonly string[]).includes(value);
export const isSurface = (value: unknown): value is Surface => isCoreSurface(value) || isLibraryPaint(value);