export type Hex = {
    q: number;
    r: number;
};

export type Round = {
    round: number;
    radius: number;
};



export const HEX_DIRECTIONS: Hex[] = [
    { q: 1, r: 0 },
    { q: 1, r: -1 },
    { q: 0, r: -1 },
    { q: -1, r: 0 },
    { q: -1, r: 1 },
    { q: 0, r: 1 },
];

// The board sizes a DM can pick (rings of hexes around the centre). This is only the list of OPTIONS: each board keeps its
// own radius in its look (look.radius, see radiusOf in scene.ts), and boards made before sizes existed use the old 12.
export const BOARD_SIZES: readonly number[] = [10, 12, 14, 18, 22, 30];
export const DEFAULT_BOARD_RADIUS = 12;
export const MAX_BOARD_RADIUS = BOARD_SIZES[BOARD_SIZES.length - 1];
export const isBoardSize = (n: unknown): n is number => BOARD_SIZES.includes(n as number);

export function neighbors (hex: Hex): Hex[] {
    const add = (a: Hex, b: Hex): Hex => ({ q: a.q + b.q, r: a.r + b.r });
    return HEX_DIRECTIONS.map(dir => add(hex, dir));
}

// Which sides of a hex are missing from a set, as a bit mask (bit i matches HEX_DIRECTIONS[i]).
// For water, pass the water hexes: a set bit means that side faces land (or the edge of the board).
export function waterShoreEdges(hex: Hex, present: ReadonlySet<string>): number {
    let mask = 0;
    for (let i = 0; i < HEX_DIRECTIONS.length; i++) {
        const d = HEX_DIRECTIONS[i];
        if (!present.has(hexKey({ q: hex.q + d.q, r: hex.r + d.r }))) mask |= 1 << i;
    }
    return mask;
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

// Is this hex on a board of this radius? (Pass the board's own radius: radiusOf(scene.look).)
export const onBoard = (hex: Hex, radius: number = DEFAULT_BOARD_RADIUS): boolean => distance({ q: 0, r: 0 }, hex) <= radius;







