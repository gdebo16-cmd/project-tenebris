import { type RefObject, useState, useRef, useEffect, useMemo } from 'react'
import { type Token } from '../../../features/table/hooks/tableQueries.ts'
import { type Hex, hexKey } from '@tenebris/rules/board'
import { type ThreeEvent } from '@react-three/fiber'
import { type AreaKind, hexLine } from '@tenebris/rules/sight'
import { brushAround, hexUnder } from '../../../features/table/hooks/tableUtils.ts'
import { worldToHex, rimOuter } from './ground/TableScenery.tsx'
import { HoverGlow } from './moments/BoardMoments.tsx'
import { HexPatches, AreaPreview } from './overlays/BoardActs.tsx'
import { MeasureLine } from '../panels/BoardLibrary.tsx'

// The hex under the mouse, and the footprints to it. Kept in its own small component on purpose: the mouse crosses
// hexes many times a second, and only this little piece needs to redraw when it does (not the whole board).
export function HoverLayer({ radius, heights, walls, walker, preview, onHexClick, brush, onStroke, measuring, labels }: {
    radius: number;
    measuring: boolean;                        // the Measure tool: press, drag, see how far
    labels: RefObject<HTMLDivElement | null>;
    heights: Record<string, number>; walls: Set<string>; walker: Token | null;
    onHexClick: (hex: Hex, e: ThreeEvent<MouseEvent>) => void;
    brush: number | null;                      // painting: rings around the mouse (0 = one hex); null = not painting
    onStroke: (hexes: Hex[]) => void;          // a finished stroke (or a single click), sent to the server at once
    preview: { kind: AreaKind; sizeFt: number; from: Hex | null } | null;   // a shape to show under the mouse
}) {
    const [hover, setHover] = useState<Hex | null>(null);
    // ---- painting: press, drag across hexes (they're collected and shown), let go: one request for the whole stroke ----
    const stroke = useRef<Map<string, Hex> | null>(null);
    const lastHex = useRef<Hex | null>(null);   // where the stroke was at the last mouse move
    const [strokeHexes, setStrokeHexes] = useState<Hex[]>([]);
    const addToStroke = (h: Hex) => {
        if (!stroke.current || brush === null) return;
        // a fast drag jumps several hexes between two mouse moves: fill in the straight line between them
        const along = lastHex.current ? hexLine(lastHex.current, h) : [h];
        lastHex.current = h;
        let grew = false;
        for (const step of along) {
            for (const x of brushAround(step, brush, radius)) {
                const k = hexKey(x);
                if (!stroke.current.has(k)) { stroke.current.set(k, x); grew = true; }
            }
        }
        if (grew) setStrokeHexes([...stroke.current.values()]);
    };
    const endStroke = () => {
        if (!stroke.current) return;
        const hexes = [...stroke.current.values()];
        stroke.current = null;
        setStrokeHexes([]);
        if (hexes.length) onStroke(hexes);
    };
    // ---- measuring: from where the mouse was pressed to where it is now (stays on show until the next press) ----
    const [measure, setMeasure] = useState<{ from: Hex; to: Hex } | null>(null);
    const measuringNow = useRef(false);
    useEffect(() => { if (!measuring) setMeasure(null); }, [measuring]);
    const footprint = useMemo(() => (brush !== null && hover ? brushAround(hover, brush, radius) : []), [brush, radius, hover?.q, hover?.r]);
    return (
        <>
            {/* an invisible sheet over the board that only notices which hex the mouse is over */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.1, 0]}
                onPointerMove={(e) => {
                    const h = worldToHex(e.point.x, e.point.z);
                    const inside = Math.max(Math.abs(h.q), Math.abs(h.r), Math.abs(h.q + h.r)) <= radius;
                    setHover((old) => (!inside ? null : old && old.q === h.q && old.r === h.r ? old : h));
                    if (stroke.current && inside) addToStroke(hexUnder(e.ray, heights));
                    if (measuringNow.current && inside) {
                        const to = hexUnder(e.ray, heights);
                        setMeasure((m) => (m && (m.to.q !== to.q || m.to.r !== to.r) ? { ...m, to } : m));
                    }
                }}
                onPointerOut={() => setHover(null)}
                onPointerDown={(e) => {
                    if (measuring && e.button === 0) {
                        (e.target as Element).setPointerCapture?.(e.pointerId);
                        const at = hexUnder(e.ray, heights);
                        measuringNow.current = true;
                        setMeasure({ from: at, to: at });
                        return;
                    }
                    if (brush === null || e.button !== 0) return;        // only the left button paints
                    (e.target as Element).setPointerCapture?.(e.pointerId); // keep the stroke even if the mouse leaves the board
                    stroke.current = new Map();
                    lastHex.current = null;
                    addToStroke(hexUnder(e.ray, heights));
                }}
                onPointerUp={() => { measuringNow.current = false; endStroke(); }}
                onPointerCancel={() => { measuringNow.current = false; endStroke(); }}
                onClick={(e) => {
                    if (brush !== null || measuring) return;             // painting / measuring: handled by press and drag
                    // Which hex was clicked: one answer per click, from where the mouse's line meets the board.
                    // (Before, every tile listened for itself, and a click could reach dozens of them at once.)
                    const hex = hexUnder(e.ray, heights);
                    if (Math.max(Math.abs(hex.q), Math.abs(hex.r), Math.abs(hex.q + hex.r)) <= radius) onHexClick(hex, e);
                }}>
                <planeGeometry args={[rimOuter(radius) * 2 + 10, rimOuter(radius) * 2 + 10]} />
                <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
            <HoverGlow hex={hover} heights={heights} />
            {/* painting: the brush under the mouse, and the stroke so far */}
            {brush !== null && <HexPatches hexes={footprint} color="#ffe08a" opacity={0.22} heights={heights} y={0.113} />}
            {strokeHexes.length > 0 && <HexPatches hexes={strokeHexes} color="#ffd060" opacity={0.42} heights={heights} y={0.114} />}
            {measure && <MeasureLine from={measure.from} to={measure.to} heights={heights} labels={labels} />}
            <AreaPreview area={preview && hover ? { kind: preview.kind, at: hover, sizeFt: preview.sizeFt } : null}
                from={preview?.from ? { q: preview.from.q, r: preview.from.r } : null} heights={heights} />
        </>
    );
}
