import { type Hex, hexKey } from '@tenebris/rules/board';

// Axial (q, r) -> world position, flat-top hexes of radius `size`
export function hexToWorld(hex: Hex, size: number): [number, number, number] {
    const x = 1.5 * size * hex.q;
    const z = Math.sqrt(3) * size * (hex.r + hex.q / 2);
    return [x, 0, z];
}

// World position -> the hex it's in (the reverse of hexToWorld, rounded to the nearest whole hex)
export function worldToHex(x: number, z: number): Hex {
    const q = (2 / 3) * x;
    const r = z / Math.sqrt(3) - x / 3;
    const s = -q - r;
    let rq = Math.round(q), rr = Math.round(r);
    const rs = Math.round(s);
    const dq = Math.abs(rq - q), dr = Math.abs(rr - r), ds = Math.abs(rs - s);
    if (dq > dr && dq > ds) rq = -rr - rs;          // the coordinate that rounded furthest is worked out from the other two
    else if (dr > ds) rr = -rq - rs;
    return { q: rq, r: rr };
}

export const HEIGHT_STEP = 0.35;   // one level of raised ground (looks only: walking ignores height until step 18)
// How far a hex's ground is raised (heights come from the scene's look: { "q,r": 1..3 })
export const liftOf = (heights: Record<string, number> | undefined, hex: Hex) => (heights?.[hexKey(hex)] ?? 0) * HEIGHT_STEP;

export const rimInner = (radius: number) => radius * Math.sqrt(3) + 1.3;    // distance to the corner hexes, plus a little room
export const rimOuter = (radius: number) => rimInner(radius) + 1.3;           // how wide the wood is
