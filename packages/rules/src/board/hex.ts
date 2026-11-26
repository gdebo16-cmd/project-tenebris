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







