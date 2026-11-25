// Small moments on the board (Stage 2 polish), all looks only:
//   TurnSpotlight : a soft spotlight follows whoever's turn it is
//   HoverGlow     : the hex under the mouse glows faintly
//   PathPreview   : footprints show the way a selected token would walk
//   Grass         : little swaying grass blades on grass hexes
//   HitBurst      : a ring of light bursts out when a token is hurt (red) or healed (green)
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Instance, Instances } from '@react-three/drei'
import { Object3D, type InstancedMesh, type Mesh, type MeshBasicMaterial, type SpotLight, type Material } from 'three'
import { type Hex } from '@tenebris/rules/board'
import { hexToWorld, fixedRandom, liftOf } from './TableScenery.tsx'
import { waterTime } from './boardLooks.ts'

type Heights = Record<string, number>;

// ---- whose turn: a spotlight that glides to them ----

// Always there (so the scene's lights never change count, which would make the graphics card rebuild every
// material and flash); with nobody's turn it simply fades to dark.
export function TurnSpotlight({ at }: { at: [number, number, number] | null }) {
    const light = useRef<SpotLight>(null);
    useFrame((_, delta) => {
        const l = light.current;
        if (!l) return;
        const ease = Math.min(1, delta * 4);
        l.intensity += ((at ? 60 : 0) - l.intensity) * ease;
        if (at) {
            l.target.position.x += (at[0] - l.target.position.x) * ease;
            l.target.position.z += (at[2] - l.target.position.z) * ease;
            l.target.position.y = at[1];
            l.position.set(l.target.position.x, at[1] + 7, l.target.position.z + 0.5);
            l.target.updateMatrixWorld();
        }
    });
    return <spotLight ref={light} angle={0.2} penumbra={0.8} decay={2} distance={20} intensity={0} color="#fff0c8" />;
}

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
    return (
        <mesh position={[x, 0.104 + liftOf(heights, hex), z]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
            <circleGeometry args={[0.97, 6]} />
            <meshBasicMaterial color="#fff4d0" transparent opacity={0.14} depthWrite={false} />
        </mesh>
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

// ---- grass ----

const BLADES_PER_HEX = 22;

// Sway: the higher up a blade a point is, the more it leans with a slow wind (the wind is waterTime, the board's clock)
function swayGrass(shader: Parameters<Material['onBeforeCompile']>[0]) {
    shader.uniforms.uWind = waterTime;
    shader.vertexShader = 'uniform float uWind;\n' + shader.vertexShader.replace('#include <begin_vertex>', /* glsl */ `
#include <begin_vertex>
float up = max(0.0, position.y + 0.5);            // 0 at the root, 1 at the tip
vec3 root = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
float gust = sin(uWind * 1.7 + root.x * 0.9 + root.z * 0.7) * 0.5 + sin(uWind * 2.9 + root.z * 1.3) * 0.25;
transformed.x += gust * up * up * 0.35;
transformed.z += gust * up * up * 0.15;
`);
}

export function Grass({ hexes, heights }: { hexes: Hex[]; heights: Heights }) {
    const mesh = useRef<InstancedMesh>(null);
    const count = hexes.length * BLADES_PER_HEX;
    useEffect(() => {
        const m = mesh.current;
        if (!m) return;
        const o = new Object3D();
        let i = 0;
        for (const hex of hexes) {
            const [cx, , cz] = hexToWorld(hex, 1);
            const base = 0.1 + liftOf(heights, hex);
            for (let b = 0; b < BLADES_PER_HEX; b++) {
                const angle = fixedRandom(hex, 60 + b) * Math.PI * 2;
                const out = Math.sqrt(fixedRandom(hex, 90 + b)) * 0.82;
                const tall = 0.09 + fixedRandom(hex, 120 + b) * 0.12;
                o.position.set(cx + Math.cos(angle) * out, base + tall / 2, cz + Math.sin(angle) * out);
                o.rotation.set(0, fixedRandom(hex, 150 + b) * Math.PI, (fixedRandom(hex, 180 + b) - 0.5) * 0.5);
                o.scale.set(0.025, tall, 0.025);
                o.updateMatrix();
                m.setMatrixAt(i++, o.matrix);
            }
        }
        m.count = i;
        m.instanceMatrix.needsUpdate = true;
        m.computeBoundingSphere();
    }, [hexes, heights]);
    if (count === 0) return null;
    return (
        <instancedMesh ref={mesh} args={[undefined, undefined, count]} raycast={() => null} receiveShadow>
            {/* one blade: a thin cone, base at the bottom */}
            <coneGeometry args={[1, 1, 3]} />
            <meshStandardMaterial color="#5f8f3e" roughness={0.9} onBeforeCompile={swayGrass} />
        </instancedMesh>
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
