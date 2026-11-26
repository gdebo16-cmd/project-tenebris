import { type TerrainKind, type Surface, type FeatureKind } from '@tenebris/rules/board'
import { type AreaKind } from '@tenebris/rules/sight'
import { type ActChoice } from '@tenebris/rules/combat'

// What a click on a hex does
export type Tool =
    | { type: 'move' }
    | { type: 'paint'; terrain: TerrainKind | null }     // the rules (wall, water...)
    | { type: 'erase' }                                  // the eraser: terrain, ground, what's placed and height all go
    | { type: 'surface'; surface: Surface | null }       // the look; null = back to the default ground
    | { type: 'feature'; kind: FeatureKind | null; size: number; color: string }   // place a light, tree...; null = remove
    | { type: 'place' }
    | { type: 'height'; height: number }                 // raise the ground (0 = flat)
    | { type: 'scene' }                                  // the scene's mood, weather, room and map picture
    | { type: 'shape'; kind: AreaKind; sizeFt: number; turns: number; name: string }    // draw a shape (anyone)
    | { type: 'measure' };                               // drag from one hex to another: how far (anyone, play session)

// Step 17: an action picked from the Act menu, waiting for its target (a token) or its area (a hex)
export type Acting = { choice: ActChoice; castLevel: number | null; mode: 'target' | 'area'; kind: AreaKind; sizeFt: number; keepTurns: number };

export const SIZES_FT = [5, 10, 15, 20, 30, 40, 60];

// What "size" means for each shape: a circle's radius (a 20 ft radius is 45 ft across), a square's width, a cone or line's length
export const SIZE_WORD: Record<AreaKind, string> = { circle: 'Radius', square: 'Width', cone: 'Length', line: 'Length' };

// The tools that paint (click or drag): terrain, the eraser, ground, placed things, raised ground
export const PAINT_TOOLS: Tool['type'][] = ['paint', 'erase', 'surface', 'feature', 'height'];

// brush sizes: [label, rings around the mouse]
export const BRUSHES: [string, number][] = [['1 hex', 0], ['7', 1], ['19', 2]];

// What floats over a token after an action that didn't change its HP (a miss, a save). Hits show through the HP.
export type Notice = { id: string; text: string };
