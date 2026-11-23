export type Hex = {
    q: number;
    r: number;
};

export const HEX_DIRECTIONS: Hex[] = [
    { q: 1, r: 0 },
    { q: 1, r: -1 },
    { q: 0, r: -1 },
    { q: -1, r: 0 },
    { q: -1, r: 1 },
    { q: 0, r: 1 },
];

export function neighbors (hex: Hex): Hex[] {
    const add = (a: Hex, b: Hex): Hex => ({ q: a.q + b.q, r: a.r + b.r });
    return HEX_DIRECTIONS.map(dir => add(hex, dir));
}


export function distance(a: Hex, b: Hex): number {
    const dq = b.q - a.q;
    const dr = b.r - a.r;
    const ds = dq + dr;
    const dist = Math.abs(dq) + Math.abs(dr) + Math.abs(ds);
    return dist / 2;
}   

export function hexKey(hex: Hex): string {
    return `${hex.q},${hex.r}`;
}

export function findPath(start: Hex, goal: Hex, walls: Set<string>, maxSteps: number): Hex[] | null {
    const queue: Hex[] = [start];
    const cameFrom = new Map<string, Hex | null>();
    const steps = new Map<string, number>();
    
    steps.set(hexKey(start), 0);
    cameFrom.set(hexKey(start), null);

    while (queue.length > 0) {
        const current = queue.shift()!;
        if (hexKey(current) === hexKey(goal)) break;

        for (const neighbor of neighbors(current)) {
            const next = neighbor;
            const key = hexKey(next);
            const nextSteps = steps.get(hexKey(current))! + 1;
            if (walls.has(key) || cameFrom.has(key) || nextSteps > maxSteps) continue;
            steps.set(key, nextSteps);
            queue.push(next);
            cameFrom.set(key, current);
        }
    }
    
    if (!cameFrom.has(hexKey(goal))) return null;
    const path: Hex[] = [];
    let step: Hex | null = goal;
    while (step) {
        path.push(step);
        step = cameFrom.get(hexKey(step)) ?? null;
    }
    return path.reverse();
    
}

// ---- Step 11–13: the grid, terrain and speed (added by Claude, 2026-11-23) ----

// Every hex at most `radius` steps from `center`: the centre, then ring 1, ring 2... (a big hexagon of hexes).
// The board draws these as its grid.
export function hexesWithin(center: Hex, radius: number): Hex[] {
    const out: Hex[] = [];
    for (let dq = -radius; dq <= radius; dq++) {
        for (let dr = -radius; dr <= radius; dr++) {
            const hex = { q: center.q + dq, r: center.r + dr };
            if (distance(center, hex) <= radius) out.push(hex);
        }
    }
    return out;
}

// What a DM can paint on a hex (null on the server = erase back to open ground).
// One list for the server (which checks paints) and the board (which shows the brushes).
export const TERRAIN_KINDS = ['wall', 'water', 'rough', 'ice'] as const;
export type TerrainKind = (typeof TERRAIN_KINDS)[number];
export const isTerrainKind = (value: unknown): value is TerrainKind => TERRAIN_KINDS.includes(value as TerrainKind);

// Terrain nothing can walk into or through. (Water, rough ground and ice will cost extra movement later; not decided yet.)
export const BLOCKING_TERRAIN: readonly TerrainKind[] = ['wall'];

// A scene's terrain map ({ "2,0": "wall", ... }) -> the hexKeys that block movement, ready for findPath
export function wallsOf(terrain: Record<string, string>): Set<string> {
    return new Set(Object.keys(terrain).filter((key) => BLOCKING_TERRAIN.includes(terrain[key] as TerrainKind)));
}

// The grid is 5 ft per hex (a hard rule). A creature's speed in feet -> how many hexes it can walk.
export const FEET_PER_HEX = 5;
export const hexesForSpeed = (speedFt: number): number => Math.max(0, Math.floor(speedFt / FEET_PER_HEX));
