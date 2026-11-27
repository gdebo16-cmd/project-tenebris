// Steps 17 and 18 on the board:
//   Fog          : black over what the party has never seen, a dark veil over what it saw before but can't see now
//   Overlays     : the shapes left on the board (spell areas, shapes someone drew), with their name and turns left
//   AreaPreview  : the hexes a spell or shape would cover, under the mouse, before you click
//   AreaFlash    : the hexes an action just hit flash red for a moment
// The server decides all of it (what's seen, what's covered, what was hit); these only draw it.
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, Instance, Instances } from '@react-three/drei'
import type { Group, MeshBasicMaterial } from 'three'
import { type Hex, hexKey } from '@tenebris/rules/board';
import { areaHexes, type Area } from '@tenebris/rules/sight'
import { hexToWorld, liftOf } from '../ground/TableScenery.tsx'
import type { Fog as FogState, Overlay } from '../../../../features/table/hooks/tableQueries.ts'
import styles from '../../../../styles/features/table/pages/TablePage.module.css'

type Heights = Record<string, number>;
const at = (hex: Hex, y: number, heights: Heights): [number, number, number] => {
    const [x, , z] = hexToWorld(hex, 1);
    return [x, y + liftOf(heights, hex), z];
};
const keyToHex = (key: string): Hex => { const [q, r] = key.split(',').map(Number); return { q, r }; };

// Flat hexes lying on the board, all in one draw: the shared look of previews, overlays and flashes
export function HexPatches({ hexes, color, opacity, heights, y = 0.108 }: { hexes: Hex[]; color: string; opacity: number; heights: Heights; y?: number }) {
    if (hexes.length === 0) return null;
    // Instances keeps the room it was made with, so a growing list (the Measure line) needs a bigger one:
    // round up to the next power of two and remake it only when that changes
    const room = 2 ** Math.ceil(Math.log2(hexes.length));
    return (
        <Instances key={room} limit={room} raycast={() => null}>
            <circleGeometry args={[0.96, 6]} />
            <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} />
            {hexes.map((h) => <Instance key={hexKey(h)} position={at(h, y, heights)} rotation={[-Math.PI / 2, 0, 0]} />)}
        </Instances>
    );
}

// ---- the fog ----

// Players: unexplored hexes are covered by tall black columns (nothing shows through, not even the map picture),
// explored-but-unseen ones by a dark veil. The DM sees the same, but see-through, to know what the players see.
export function Fog({ hexes, fog, dm }: { hexes: Hex[]; fog: FogState | null; dm: boolean }) {
    const { hidden, dim } = useMemo(() => {
        if (!fog) return { hidden: [] as Hex[], dim: [] as Hex[] };
        const visible = new Set(fog.visible), explored = new Set(fog.explored);
        const hidden: Hex[] = [], dim: Hex[] = [];
        for (const h of hexes) {
            const key = hexKey(h);
            if (!explored.has(key)) hidden.push(h);
            else if (!visible.has(key)) dim.push(h);
        }
        return { hidden, dim };
    }, [hexes, fog]);
    if (!fog) return null;
    return (
        <group raycast={() => null}>
            {hidden.length > 0 && (
                <Instances limit={hidden.length} raycast={() => null}>
                    {/* players: a tall black column. The DM: a thin see-through sheet lying on the board, so it stays readable */}
                    <cylinderGeometry args={[1.001, 1.001, dm ? 0.02 : 3.2, 6]} />
                    <meshBasicMaterial color="#000000" transparent={dm} opacity={dm ? 0.5 : 1} depthWrite={!dm} />
                    {hidden.map((h) => { const [x, , z] = hexToWorld(h, 1); return <Instance key={hexKey(h)} position={[x, dm ? 0.116 : 1.5, z]} rotation={[0, Math.PI / 6, 0]} />; })}
                </Instances>
            )}
            {dim.length > 0 && (
                <Instances limit={dim.length} raycast={() => null}>
                    <cylinderGeometry args={[1.001, 1.001, dm ? 0.02 : 3.0, 6]} />
                    <meshBasicMaterial color="#05060a" transparent opacity={dm ? 0.22 : 0.55} depthWrite={false} />
                    {dim.map((h) => { const [x, , z] = hexToWorld(h, 1); return <Instance key={hexKey(h)} position={[x, dm ? 0.116 : 1.4, z]} rotation={[0, Math.PI / 6, 0]} />; })}
                </Instances>
            )}
        </group>
    );
}

// ---- shapes on the board ----

export function Overlays({ overlays, userId, heights, labels }: {
    overlays: Overlay[]; userId: number; heights: Heights; labels: RefObject<HTMLDivElement | null>;
}) {
    return (
        <>
            {overlays.map((o) => {
                const hexes = areaHexes(o.area, o.from ?? o.area.at);
                const color = o.ownerId === userId ? '#4d8fe0' : '#e0a63b';     // yours blue, everyone else's amber
                const label = o.area.kind === 'cone' || o.area.kind === 'line' ? hexes[Math.floor(hexes.length / 2)] ?? o.area.at : o.area.at;
                return (
                    <group key={o.id}>
                        <HexPatches hexes={hexes} color={color} opacity={0.28} heights={heights} />
                        <Html position={at(label, 0.5, heights)} center pointerEvents="none" portal={labels as RefObject<HTMLElement>}>
                            <span className={styles.overlayLabel}>{o.name}{o.turnsLeft != null ? ` · ${o.turnsLeft}` : ''}</span>
                        </Html>
                    </group>
                );
            })}
        </>
    );
}

// ---- before you click: what the shape would cover ----

export function AreaPreview({ area, from, heights }: { area: Area | null; from: Hex | null; heights: Heights }) {
    const hexes = useMemo(() => (area ? areaHexes(area, from ?? area.at) : []), [area?.kind, area?.sizeFt, area?.at.q, area?.at.r, from?.q, from?.r]);
    return <HexPatches hexes={hexes} color="#ff8a4a" opacity={0.32} heights={heights} y={0.11} />;
}

// ---- after an action: the hit area flashes and fades ----

export function AreaFlash({ keys, flashId, heights }: { keys: string[] | null; flashId: string | null; heights: Heights }) {
    const group = useRef<Group>(null);
    const [shown, setShown] = useState<{ id: string; hexes: Hex[] } | null>(null);
    const age = useRef(0);
    useEffect(() => {
        if (!flashId || !keys?.length) return;
        age.current = 0;
        setShown({ id: flashId, hexes: keys.map(keyToHex) });
    }, [flashId]);
    useFrame((_, delta) => {
        if (!shown || !group.current) return;
        age.current += delta;
        const fade = Math.max(0, 1 - age.current / 1.4);
        group.current.traverse((o) => {
            const m = (o as { material?: MeshBasicMaterial }).material;
            if (m) m.opacity = 0.7 * fade;
        });
        if (fade === 0) setShown(null);
    });
    if (!shown) return null;
    return (
        <group ref={group} key={shown.id}>
            <HexPatches hexes={shown.hexes} color="#ff3b2a" opacity={0.7} heights={heights} y={0.112} />
        </group>
    );
}
