// Small moments on the board (Stage 2 polish), all looks only:
//   TurnSpotlight : a soft spotlight follows whoever's turn it is
//   HoverGlow     : the hex under the mouse glows faintly
//   PathPreview   : footprints show the way a selected token would walk
//   HitBurst      : a ring of light bursts out when a token is hurt (red) or healed (green)
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Instance, Instances } from '@react-three/drei'
import { type Mesh, type MeshBasicMaterial, type SpotLight } from 'three'
import { type Hex } from '@tenebris/rules/board'
import { hexToWorld, fixedRandom, liftOf } from '../ground/TableScenery.tsx'

type Heights = Record<string, number>;

// ---- whose turn: a spotlight that glides to them ----

// Always there (so the scene's lights never change count, which would make the graphics card rebuild every
// material and flash); with nobody's turn it simply fades to dark.
export function TurnSpotlight({ at, strength = 60, angle = 0.2 }: { at: [number, number, number] | null; strength?: number; angle?: number }) {
    const light = useRef<SpotLight>(null);
    useFrame((_, delta) => {
        const l = light.current;
        if (!l) return;
        const ease = Math.min(1, delta * 7);       
        l.intensity += ((at ? strength : 0) - l.intensity) * ease;
        if (at) {
            l.target.position.x += (at[0] - l.target.position.x) * ease;
            l.target.position.z += (at[2] - l.target.position.z) * ease;
            l.target.position.y = at[1];
            l.position.set(l.target.position.x, at[1] + 7, l.target.position.z + 0.5);
            l.target.updateMatrixWorld();
        }
    });
    return <spotLight ref={light} angle={angle} penumbra={0.8} decay={2} distance={20} intensity={0} color="#fff0c8" />;}

// The current turn's glowing ring on the board, under the token
export function TurnRing({ at }: { at: [number, number, number] | null }) {
    const ring = useRef<Mesh>(null);
    useFrame(({ clock }) => {
        const m = ring.current;
        if (!m || !at) return;
        m.position.set(at[0], at[1] + 0.006, at[2]);
        const s = 1 + Math.sin(clock.elapsedTime * 2.5) * 0.05;
        m.scale.set(s, s, s);
    });
    if (!at) return null;
    return (
        <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
            <ringGeometry args={[0.62, 0.82, 48]} />
            <meshBasicMaterial color={[2.4, 1.9, 0.8]} toneMapped={false} transparent opacity={0.9} />
        </mesh>
    );
}

// ---- the hex under the mouse ----

export function HoverGlow({ hex, heights }: { hex: Hex | null; heights: Heights }) {
    if (!hex) return null;
    const [x, , z] = hexToWorld(hex, 1);
    const y = 0.108 + liftOf(heights, hex);
    // T4: a clear outline so the hex under the mouse is obvious even when the grid is off
    return (
        <group position={[x, y, z]} rotation={[-Math.PI / 2, 0, 0]}>
            <mesh raycast={() => null}>
                <circleGeometry args={[0.82, 6]} />
                <meshBasicMaterial color="#fff4d0" transparent opacity={0.08} depthWrite={false} />
            </mesh>
            <mesh raycast={() => null}>
                <ringGeometry args={[0.8, 0.97, 6]} />
                <meshBasicMaterial color="#fff4d0" transparent opacity={0.85} depthWrite={false} />
            </mesh>
        </group>
    );
}

// ---- where a token would walk ----

// Footprints along the path: alternating left and right, turned the way they're walking. The last hex gets a ring.
export function PathPreview({ path, heights }: { path: Hex[] | null; heights: Heights }) {
    const prints = useMemo(() => {
        if (!path || path.length < 2) return [];
        const out: { x: number; y: number; z: number; turn: number }[] = [];
        for (let i = 1; i < path.length; i++) {
            const [ax, , az] = hexToWorld(path[i - 1], 1);
            const [bx, , bz] = hexToWorld(path[i], 1);
            const turn = Math.atan2(bx - ax, bz - az);
            const y = 0.105 + liftOf(heights, path[i]);
            for (const [t, side] of [[0.35, -1], [0.75, 1]] as const) {      // two steps per hex
                const sx = Math.cos(turn) * 0.13 * side, sz = -Math.sin(turn) * 0.13 * side;
                out.push({ x: ax + (bx - ax) * t + sx, y, z: az + (bz - az) * t + sz, turn });
            }
        }
        return out;
    }, [path, heights]);
    if (!path || path.length < 2) return null;
    const end = path[path.length - 1];
    const [ex, , ez] = hexToWorld(end, 1);
    return (
        <group raycast={() => null}>
            {prints.length > 0 && (
                <Instances limit={prints.length} raycast={() => null}>
                    <circleGeometry args={[1, 12]} />
                    <meshBasicMaterial color="#f5e6c0" transparent opacity={0.55} depthWrite={false} />
                    {prints.map((p, i) => (
                        <Instance key={i} position={[p.x, p.y, p.z]} rotation={[-Math.PI / 2, 0, p.turn]} scale={[0.07, 0.12, 1]} />
                    ))}
                </Instances>
            )}
            <mesh position={[ex, 0.106 + liftOf(heights, end), ez]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.55, 0.68, 40]} />
                <meshBasicMaterial color="#f5e6c0" transparent opacity={0.6} depthWrite={false} />
            </mesh>
        </group>
    );
}

// ---- hurt and healed ----

// A ring that bursts outward and fades. Changing `key` from outside starts a new one.
export function HitBurst({ heal }: { heal: boolean }) {
    const ring = useRef<Mesh>(null);
    const age = useRef(0);
    useFrame((_, delta) => {
        const m = ring.current;
        if (!m) return;
        age.current += delta;
        const t = Math.min(1, age.current / 0.6);
        const s = 0.4 + t * 1.4;
        m.scale.set(s, s, s);
        (m.material as MeshBasicMaterial).opacity = (1 - t) * 0.9;
        m.visible = t < 1;
    });
    return (
        <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.2, 0]} raycast={() => null}>
            <ringGeometry args={[0.7, 0.85, 40]} />
            <meshBasicMaterial color={heal ? [0.6, 3, 1] : [3.5, 0.5, 0.3]} toneMapped={false} transparent depthWrite={false} />
        </mesh>
    );
}
