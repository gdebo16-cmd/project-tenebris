// Features the DM places on hexes (Stage 2 polish): lights and terrain pieces, saved with the scene.
//   lights  : light (a glowing orb, any colour and reach), brazier (a fire bowl)
//   blockers: tree (thick), boulder, pillar — these block movement like walls (rules: BLOCKING_FEATURES in @tenebris/rules/hex)
//   others  : thin tree, bush, rubble (rough: +1 to walk in), crate, barrel (climbed over: +2): OBJECT_RULES in the rules
// Every piece is built from simple shapes in code, in the same painted style as the board. Clicking a piece clicks
// its hex, so the DM's brushes still work on top of it.
import { useRef } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import type { Mesh, PointLight } from 'three'
import { type Hex, type Feature } from '@tenebris/rules/board'
import { hexToWorld, fixedRandom, liftOf } from './TableScenery.tsx'
import { paintStone } from './boardLooks.ts'

type Click = (hex: Hex, e: ThreeEvent<MouseEvent>) => void;

// What each feature is called on the DM's buttons, and its default colour where it has one
export const FEATURE_LOOK: Record<Feature['kind'], { label: string; color?: string }> = {
    light:   { label: 'Light', color: '#ffd08a' },
    brazier: { label: 'Brazier' },
    tree:    { label: 'Tree' },
    bush:    { label: 'Bush' },
    boulder: { label: 'Boulder' },
    pillar:  { label: 'Pillar' },
    crate:   { label: 'Crate' },
    barrel:  { label: 'Barrel' },
    rubble:  { label: 'Rubble' },
    thinTree: { label: 'Thin tree' },
};

// A light that flickers gently (fire) or glows steadily (magic)
function useFlicker(light: React.RefObject<PointLight | null>, base: number, seed: number, fire: boolean) {
    useFrame(({ clock }) => {
        if (!light.current) return;
        const t = clock.elapsedTime + seed;
        light.current.intensity = fire
            ? base * (0.8 + 0.12 * Math.sin(t * 7.3) + 0.06 * Math.sin(t * 13.1) + 0.05 * Math.sin(t * 23.7))
            : base * (0.95 + 0.05 * Math.sin(t * 1.3));
    });
}

function Light({ color, size, seed }: { color: string; size: number; seed: number }) {
    const light = useRef<PointLight>(null);
    const orb = useRef<Mesh>(null);
    useFlicker(light, 10, seed, false);
    useFrame(({ clock }) => { if (orb.current) orb.current.position.y = 1.2 + Math.sin(clock.elapsedTime * 1.1 + seed) * 0.06; });
    return (
        <>
            <mesh ref={orb} position={[0, 1.2, 0]}>
                <sphereGeometry args={[0.12, 16, 16]} />
                <meshBasicMaterial color={color} toneMapped={false} />
            </mesh>
            {/* size = how far the light reaches (in hexes, roughly) */}
            <pointLight ref={light} position={[0, 1.2, 0]} color={color} distance={4 * size + 2} decay={2} intensity={10} />
        </>
    );
}

function Brazier({ seed }: { seed: number }) {
    const light = useRef<PointLight>(null);
    const flame = useRef<Mesh>(null);
    useFlicker(light, 10, seed, true);
    useFrame(({ clock }) => {
        const t = clock.elapsedTime + seed;
        const f = 0.85 + 0.15 * Math.sin(t * 9.1) + 0.05 * Math.sin(t * 17.3);
        flame.current?.scale.set(0.22 * f, 0.32 * f, 0.22 * f);
    });
    return (
        <>
            <mesh position={[0, 0.3, 0]} castShadow>
                <cylinderGeometry args={[0.06, 0.1, 0.45, 8]} />
                <meshStandardMaterial color="#2b2520" metalness={0.6} roughness={0.5} />
            </mesh>
            <mesh position={[0, 0.58, 0]} castShadow>
                <cylinderGeometry args={[0.32, 0.18, 0.18, 16, 1, true]} />
                <meshStandardMaterial color="#3a2f25" metalness={0.7} roughness={0.4} side={2} />
            </mesh>
            <mesh ref={flame} position={[0, 0.78, 0]}>
                <sphereGeometry args={[1, 12, 12]} />
                <meshBasicMaterial color={[4, 1.8, 0.5]} toneMapped={false} />
            </mesh>
            <pointLight ref={light} position={[0, 0.95, 0]} color="#ff9a45" distance={8} decay={2} intensity={10} />
        </>
    );
}

function Tree({ seed }: { seed: number }) {
    const lean = (seed % 1) * 0.15 - 0.075;
    return (
        <group rotation={[lean, 0, -lean]}>
            <mesh position={[0, 0.5, 0]} castShadow>
                <cylinderGeometry args={[0.1, 0.16, 1, 8]} />
                <meshStandardMaterial color="#5a4030" roughness={1} onBeforeCompile={paintStone} />
            </mesh>
            {/* three leafy clumps, a bit different on every tree */}
            {[[0, 1.25, 0, 0.62], [0.28, 1.05, 0.12, 0.42], [-0.22, 1.1, -0.18, 0.45]].map(([x, y, z, r], i) => (
                <mesh key={i} position={[x, y, z]} castShadow>
                    <icosahedronGeometry args={[r, 1]} />
                    <meshStandardMaterial color={i === 0 ? '#3d6b2a' : '#4a7a31'} roughness={1} flatShading onBeforeCompile={paintStone} />
                </mesh>
            ))}
        </group>
    );
}

function Bush() {
    return (
        <>
            {[[0, 0.28, 0, 0.32], [0.25, 0.22, 0.1, 0.24], [-0.2, 0.2, -0.12, 0.26]].map(([x, y, z, r], i) => (
                <mesh key={i} position={[x, y, z]} castShadow>
                    <icosahedronGeometry args={[r, 1]} />
                    <meshStandardMaterial color="#456f2c" roughness={1} flatShading onBeforeCompile={paintStone} />
                </mesh>
            ))}
        </>
    );
}

function Boulder() {
    return (
        <mesh position={[0, 0.35, 0]} scale={[0.75, 0.5, 0.65]} castShadow>
            <dodecahedronGeometry args={[1, 0]} />
            <meshStandardMaterial color="#7a756c" roughness={1} flatShading onBeforeCompile={paintStone} />
        </mesh>
    );
}

function Pillar() {
    return (
        <>
            <mesh position={[0, 0.08, 0]} castShadow receiveShadow>
                <cylinderGeometry args={[0.5, 0.55, 0.16, 8]} />
                <meshStandardMaterial color="#8c867a" roughness={1} onBeforeCompile={paintStone} />
            </mesh>
            <mesh position={[0, 0.9, 0]} castShadow receiveShadow>
                <cylinderGeometry args={[0.32, 0.36, 1.5, 16]} />
                <meshStandardMaterial color="#9a9488" roughness={1} onBeforeCompile={paintStone} />
            </mesh>
            <mesh position={[0, 1.72, 0]} castShadow>
                <cylinderGeometry args={[0.48, 0.38, 0.16, 8]} />
                <meshStandardMaterial color="#8c867a" roughness={1} onBeforeCompile={paintStone} />
            </mesh>
        </>
    );
}

function Crate() {
    return (
        <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.6, 0.6, 0.6]} />
            <meshStandardMaterial color="#8a6238" roughness={0.9} onBeforeCompile={paintStone} />
        </mesh>
    );
}

function Barrel() {
    return (
        <>
            <mesh position={[0, 0.35, 0]} castShadow receiveShadow>
                <cylinderGeometry args={[0.28, 0.28, 0.7, 16]} />
                <meshStandardMaterial color="#7a5232" roughness={0.9} onBeforeCompile={paintStone} />
            </mesh>
            {/* the iron hoops */}
            {[0.12, 0.58].map((y) => (
                <mesh key={y} position={[0, y, 0]}>
                    <torusGeometry args={[0.285, 0.018, 6, 24]} />
                    <meshStandardMaterial color="#2e2a26" metalness={0.7} roughness={0.5} />
                </mesh>
            ))}
        </>
    );
}

function Rubble({ hex }: { hex: Hex }) {
    return (
        <>
            {Array.from({ length: 9 }, (_, i) => {
                const a = fixedRandom(hex, i + 60) * Math.PI * 2, out = Math.sqrt(fixedRandom(hex, i + 70)) * 0.65;
                const s = 0.06 + fixedRandom(hex, i + 80) * 0.12;
                return (
                    <mesh key={i} position={[Math.cos(a) * out, s * 0.4, Math.sin(a) * out]} scale={[s, s * 0.7, s]}
                        rotation={[fixedRandom(hex, i + 90) * 6, fixedRandom(hex, i + 95) * 6, 0]} castShadow>
                        <dodecahedronGeometry args={[1, 0]} />
                        <meshStandardMaterial color="#7a756c" roughness={1} flatShading onBeforeCompile={paintStone} />
                    </mesh>
                );
            })}
        </>
    );
}

function Piece({ hex, feature }: { hex: Hex; feature: Feature }) {
    const seed = fixedRandom(hex, 33) * 100;
    switch (feature.kind) {
        case 'light':   return <Light color={feature.color ?? FEATURE_LOOK.light.color!} size={feature.size ?? 1} seed={seed} />;
        case 'brazier': return <Brazier seed={seed} />;
        case 'tree':    return <Tree seed={seed} />;
        case 'bush':    return <Bush />;
        case 'boulder': return <Boulder />;
        case 'pillar':  return <Pillar />;
        case 'crate':   return <Crate />;
        case 'barrel':  return <Barrel />;
        case 'rubble':  return <Rubble hex={hex} />;
        case 'thinTree': return <group scale={[0.55, 1.1, 0.55]}><Tree seed={seed} /></group>;
        default:        return null;
    }
}

// All the scene's features. Each stands on its hex, turned and sized; lights keep their own size as reach.
export function BoardFeatures({ features, heights, onHexClick }: { features: Record<string, Feature>; heights: Record<string, number>; onHexClick: Click }) {
    return (
        <>
            {Object.entries(features).map(([key, feature]) => {
                const [q, r] = key.split(',').map(Number);
                const hex = { q, r };
                const [x, , z] = hexToWorld(hex, 1);
                const turn = Math.floor(fixedRandom(hex, 31) * 6) * (Math.PI / 3) + fixedRandom(hex, 32) * 0.4;
                const scale = feature.kind === 'light' ? 1 : (feature.size ?? 1);
                return (
                    <group key={key} position={[x, 0.1 + liftOf(heights, hex), z]} rotation={[0, turn, 0]} scale={scale}
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => { e.stopPropagation(); onHexClick(hex, e); }}>
                        <Piece hex={hex} feature={feature} />
                    </group>
                );
            })}
        </>
    );
}
