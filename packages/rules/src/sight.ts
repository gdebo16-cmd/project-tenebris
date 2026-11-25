// Sight and areas on the hex grid (steps 17 and 18). Pure maths, used by the server (which decides) and the board
// (which previews). Flat-top hexes, 5 ft each; "blockers" is the set of hexes that block sight: walls, plus trees,
// boulders and pillars (the same set that blocks walking: wallsOf in hex.ts; owner's call, 2026-11-23).
import { type Hex, hexKey, distance, hexesWithin } from './board/hex.ts';

const SQRT3 = Math.sqrt(3);

// The middle of a hex in board units (one hex = size 1; neighbours are √3 apart). Matches the board's hexToWorld.
export function hexCenter(hex: Hex): { x: number; z: number } {
    return { x: 1.5 * hex.q, z: SQRT3 * (hex.r + hex.q / 2) };
}

// The hex a point is in (the reverse of hexCenter, rounded to the nearest whole hex)
export function hexAt(x: number, z: number): Hex {
    const q = (2 / 3) * x, r = z / SQRT3 - x / 3, s = -q - r;
    let rq = Math.round(q), rr = Math.round(r);
    const rs = Math.round(s);
    const dq = Math.abs(rq - q), dr = Math.abs(rr - r), ds = Math.abs(rs - s);
    if (dq > dr && dq > ds) rq = -rr - rs;
    else if (dr > ds) rr = -rq - rs;
    return { q: rq + 0, r: rr + 0 };          // + 0 turns -0 into 0
}

// The hexes a straight line from a to b passes through, a and b included. `nudge` shifts the line a hair sideways:
// a line that runs exactly along the edge between two hexes would otherwise pick one of them at random.
export function hexLine(a: Hex, b: Hex, nudge = 0): Hex[] {
    const n = distance(a, b);
    if (n === 0) return [a];
    const A = hexCenter(a), B = hexCenter(b);
    const out: Hex[] = [];
    for (let i = 0; i <= n; i++) {
        const t = i / n;
        out.push(hexAt(A.x + (B.x - A.x) * t + nudge, A.z + (B.z - A.z) * t + nudge));
    }
    return out;
}

// Can someone on `from` see `to`? Nothing that blocks sight may stand on the hexes in between. The line is tried a
// hair to each side, and either clear line is enough, so seeing past the corner of a wall works.
export function canSee(from: Hex, to: Hex, blockers: Set<string>): boolean {
    for (const nudge of [1e-4, -1e-4]) {
        const between = hexLine(from, to, nudge).slice(1, -1);
        if (!between.some((h) => blockers.has(hexKey(h)))) return true;
    }
    return false;
}

// Everything that can be seen from any of `eyes`, out to `radius` hexes. A blocker itself is seen (you see the wall),
// just not what's behind it. Answers hex keys.
export function visibleFrom(eyes: Hex[], blockers: Set<string>, radius: number): Set<string> {
    const seen = new Set<string>();
    for (const eye of eyes) {
        for (const hex of hexesWithin(eye, radius)) {
            const key = hexKey(hex);
            if (!seen.has(key) && canSee(eye, hex, blockers)) seen.add(key);
        }
    }
    return seen;
}

// ---- spell areas and other shapes on the board (overlays) ----

export const AREA_KINDS = ['circle', 'cone', 'line', 'square'] as const;
export type AreaKind = (typeof AREA_KINDS)[number];
// circle: everything within sizeFt of `at`.  square: a block sizeFt across, centred on `at`.
// cone and line start at the caster's hex and point towards `at`; sizeFt is how long they are.
export type Area = { kind: AreaKind; at: Hex; sizeFt: number };
export const MAX_AREA_FT = 120;

// Checks an area from a request: a known shape, a hex, and a size from 5 to 120 ft in steps of 5
export function checkArea(body: unknown): { error: string } | { area: Area } {
    const b = (body ?? {}) as Record<string, unknown>;
    if (!AREA_KINDS.includes(b.kind as AreaKind)) return { error: `shape must be one of ${AREA_KINDS.join(', ')}` };
    const at = (b.at ?? {}) as Record<string, unknown>;
    if (!Number.isInteger(at.q) || !Number.isInteger(at.r)) return { error: 'The shape needs a hex (q and r)' };
    const sizeFt = Number(b.sizeFt);
    if (!Number.isInteger(sizeFt) || sizeFt < 5 || sizeFt > MAX_AREA_FT || sizeFt % 5 !== 0) return { error: `size must be 5 to ${MAX_AREA_FT} ft, in steps of 5` };
    return { area: { kind: b.kind as AreaKind, at: { q: at.q as number, r: at.r as number }, sizeFt } };
}

// The hexes an area covers. `from` is the caster's hex (cones and lines start there and leave it out).
export function areaHexes(area: Area, from: Hex): Hex[] {
    const n = Math.max(1, Math.round(area.sizeFt / 5));            // feet -> hexes
    if (area.kind === 'circle') return hexesWithin(area.at, n);

    if (area.kind === 'square') {
        const c = hexCenter(area.at);
        const half = (n * SQRT3) / 2 + 1e-6;                           // n hexes across, measured centre to centre
        return hexesWithin(area.at, n).filter((h) => {
            const p = hexCenter(h);
            return Math.abs(p.x - c.x) <= half && Math.abs(p.z - c.z) <= half;
        });
    }

    // cone and line: they need a direction
    const o = hexCenter(from), t = hexCenter(area.at);
    const dx = t.x - o.x, dz = t.z - o.z, len = Math.hypot(dx, dz);
    if (len === 0) return [];
    const ux = dx / len, uz = dz / len;

    if (area.kind === 'line') {
        const end = hexAt(o.x + ux * n * SQRT3, o.z + uz * n * SQRT3);
        return hexLine(from, end, 1e-4).slice(1);
    }
    // cone: 60° wide (30° each side of the direction), as long as its size
    const cos30 = Math.cos(Math.PI / 6) - 1e-6;
    return hexesWithin(from, n).filter((h) => {
        if (h.q === from.q && h.r === from.r) return false;
        const p = hexCenter(h);
        const hx = p.x - o.x, hz = p.z - o.z, d = Math.hypot(hx, hz);
        return (hx * ux + hz * uz) / d >= cos30;
    });
}
