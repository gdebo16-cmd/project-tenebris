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

export const BOARD_RADIUS: number = 12;

export const onBoard = (hex: Hex) => distance({ q: 0, r: 0 }, hex) <= BOARD_RADIUS;

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








