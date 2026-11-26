import { type Hex, hexesWithin, onBoard } from '@tenebris/rules/board'
import { hexToWorld, liftOf, worldToHex } from './TableScenery.tsx'
import { BufferGeometry, Float32BufferAttribute } from 'three'
import { type ThreeEvent } from '@react-three/fiber'
import { ApiError } from '../../api.ts'
import { type Overlay, type FeedEntry, type Brush } from './tableQueries.ts'
import { type Notice, type Tool } from './tableTypes.ts'

// Starting zoom (pixels per world unit): about 17 units of map across the screen, so a phone shows as much map
// as a laptop, just smaller. Scroll or pinch changes it after that.
export const startZoom = () => Math.max(20, Math.min(75, Math.round(window.innerWidth / 17)));

// Every hex's outline in one list of line pieces (2 points per edge), so the whole grid is one draw call.
// Flat-top hexes: corners at 0°, 60°, 120°...
export function gridLines(hexes: Hex[], heights: Record<string, number>) {
    const points: number[] = [];
    for (const hex of hexes) {
        const [cx, , cz] = hexToWorld(hex, 1);
        const y = liftOf(heights, hex);
        for (let k = 0; k < 6; k++) {
            const a1 = (k * Math.PI) / 3, a2 = ((k + 1) * Math.PI) / 3;
            points.push(cx + Math.cos(a1), y, cz + Math.sin(a1), cx + Math.cos(a2), y, cz + Math.sin(a2));
        }
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(points, 3));   // every 3 numbers = one point
    return g;
}

// A click that ended a drag (panning the map) isn't a click
export const wasDrag = (e: ThreeEvent<MouseEvent>) => e.delta > 4;

export const messageOf = (err: unknown) => (err instanceof ApiError || err instanceof Error ? err.message : 'Something went wrong');

export const NO_OVERLAYS: Overlay[] = [];

// ---- Step 17: the Act menu, shapes, the feed ----

export function noticesFrom(entry: FeedEntry | null): Map<number, Notice> {
    const out = new Map<number, Notice>();
    for (const o of entry?.outcomes ?? []) {
        if (o.result === 'miss') out.set(o.tokenId, { id: `${entry!.id}-${o.tokenId}`, text: 'Miss' });
        if (o.result === 'saved') out.set(o.tokenId, { id: `${entry!.id}-${o.tokenId}`, text: 'Saved' });
    }
    return out;
}

// The hex under the mouse: where its line meets the board's surface. A raised hex's top is higher, so if the first
// answer is a raised hex, look again at that height (otherwise, with the camera tilted, clicks on hills land behind them).
export function hexUnder(ray: { origin: { x: number; y: number; z: number }; direction: { x: number; y: number; z: number } }, heights: Record<string, number>): Hex {
    const at = (y: number) => {
        const t = (y - ray.origin.y) / ray.direction.y;
        return worldToHex(ray.origin.x + ray.direction.x * t, ray.origin.z + ray.direction.z * t);
    };
    const flat = at(0.1);
    const lift = liftOf(heights, flat);
    if (lift === 0) return flat;
    const high = at(0.1 + lift);
    return liftOf(heights, high) > 0 ? high : flat;
}

// ---- the map editor ----

// The hexes a brush covers around one hex (only those on the board)
export function brushAround(hex: Hex, rings: number, radius: number): Hex[] {
    return hexesWithin(hex, rings).filter((h) => onBoard(h, radius));
}

// What the current tool paints, as the server's brush
export function brushOf(tool: Tool): Brush | null {
    switch (tool.type) {
        case 'paint': return { terrain: tool.terrain };
        case 'erase': return { clear: true };
        case 'surface': return { surface: tool.surface };
        case 'feature': return { feature: tool.kind ? { kind: tool.kind, size: tool.size, ...(tool.kind === 'light' ? { color: tool.color } : {}) } : null };
        case 'height': return { height: tool.height };
        default: return null;
    }
}
