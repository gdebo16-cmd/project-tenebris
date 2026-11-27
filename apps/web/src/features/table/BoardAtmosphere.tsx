// The table's light and atmosphere (Stage 2 polish): a warm lamp hanging over the table, soft reflections, and the
// finishing touches a camera lens would add: ambient occlusion (soft darkness where things meet), a gentle glow on bright
// things, and a vignette. Plus small signs of life: dust drifting in the lamp light and torches flickering on walls.
// Made for the TV's graphics card; turn pieces off here if a smaller machine struggles.
import { Suspense, useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Environment } from '@react-three/drei'
import { EffectComposer, N8AO, Bloom, Vignette, ToneMapping } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, ShaderMaterial, type Mesh, type PointLight } from 'three'
import { type Hex, type SceneMood } from '@tenebris/rules/board'
import { hexToWorld, wallTop, fixedRandom, rimOuter } from './TableScenery.tsx'
import { waterTime } from './boardLooks.ts'
import type { MoodLight } from './BoardWorld.tsx'

// T5: one Poly Haven HDRI per mood (2K), used as the scene's sky light only (not shown as a backdrop).
export const SKY_LIGHT: Record<SceneMood, { file: string; strength: number }> = {
    day:     { file: '/textures/hdris/day/sky.hdr',     strength: 0.9 },
    dawn:    { file: '/textures/hdris/dawn/sky.hdr',    strength: 0.55 },
    dusk:    { file: '/textures/hdris/dusk/sky.hdr',    strength: 0.5 },
    night:   { file: '/textures/hdris/night/sky.hdr',   strength: 0.28 },
    dungeon: { file: '/textures/hdris/dungeon/sky.hdr', strength: 0.16 },
};

// ---- lights ----

export function BoardLights({ mood, moodName = 'day', radius, shadowMapSize = 4096, castShadow = true }: { mood: MoodLight; moodName?: SceneMood; radius: number; shadowMapSize?: number; castShadow?: boolean }) {
    const reach = rimOuter(radius) + 3;     // how far the sun's shadows reach from the centre: the whole board and its rim
    const sky = SKY_LIGHT[moodName] ?? SKY_LIGHT.day;
    // keep the water moving (its shader reads this clock)
    useFrame((_, delta) => { waterTime.value += delta; });
    return (
        <>
            {/* T5: the sky light comes from a real photo of the sky (Poly Haven HDRI). It is not drawn as a backdrop. */}
            <Suspense fallback={null}>
                <Environment files={sky.file} background={false} environmentIntensity={sky.strength} />
            </Suspense>
            {/* a little leftover fill so tokens stay readable in dark moods (night, dungeon) */}
            <hemisphereLight args={[mood.sky, mood.ground, Math.max(0.1, mood.roomPower * 0.28)]} />
            {/* the sun's shadows: kept as the extra hand-set light; fill now comes from the sky */}
            <directionalLight position={[6, 20, 9]} intensity={mood.sunPower * 0.4} color={mood.sun} castShadow={castShadow}
                shadow-mapSize={[Math.max(512, shadowMapSize), Math.max(512, shadowMapSize)]} shadow-camera-near={1} shadow-camera-far={90}
                shadow-camera-left={-reach} shadow-camera-right={reach} shadow-camera-top={reach} shadow-camera-bottom={-reach}
                shadow-bias={-0.0003} shadow-normalBias={0.03} />
        </>
    );
}

// ---- the lens: ambient occlusion, glow, vignette ----

// ?off=ao,bloom,vignette switches single effects off, to find which one misbehaves (testing only)
const OFF = typeof window === 'undefined' ? [] : (new URLSearchParams(window.location.search).get('off') ?? '').split(',');

export function BoardEffects({ mood }: { mood: MoodLight }) {
    return (
        <EffectComposer multisampling={4}>
            {/* soft darkness where things meet: under tokens, at the foot of walls, between rocks */}
            <N8AO enabled={!OFF.includes('ao')} halfRes aoRadius={1.2} distanceFalloff={1} intensity={2.2} color="#000000" />
            {/* only really bright things glow: torch flames, the selection ring */}
            <Bloom opacity={OFF.includes('bloom') ? 0 : 1} luminanceThreshold={0.85} luminanceSmoothing={0.2} intensity={0.7} mipmapBlur />
            {/* the corners of the picture fall gently into shadow, like a lamp-lit table */}
            <Vignette offset={0.3} darkness={OFF.includes('vignette') ? 0 : mood.vignette} />
            <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        </EffectComposer>
    );
}

// ---- small life ----

// Dust drifting slowly through the lamp light
// (Our own instead of drei's Sparkles: Sparkles divides by the distance to each speck's centre, and when a speck
// lands exactly on a pixel centre that's a divide by zero. The glow effect then smeared that one broken pixel into
// a big black box across the screen: the flash. Here the brightness can never go above 1.)
const DUST_COUNT = 160;
const DUST_VERTEX = /* glsl */ `
uniform float uTime;
attribute float aSeed;
varying float vFade;
void main() {
    vec3 p = position;
    p.x += sin(uTime * 0.12 + aSeed * 6.28) * 0.6;        // drift slowly in small loops
    p.y += sin(uTime * 0.09 + aSeed * 12.0) * 0.4;
    p.z += cos(uTime * 0.10 + aSeed * 9.0) * 0.6;
    vFade = 0.5 + 0.5 * sin(uTime * 0.8 + aSeed * 20.0);   // each speck brightens and fades in its own rhythm
    gl_PointSize = 3.0;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`;
const DUST_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
varying float vFade;
void main() {
    float d = distance(gl_PointCoord, vec2(0.5));
    float soft = clamp(1.0 - d * 2.0, 0.0, 1.0);           // 1 in the middle, 0 at the edge: always a safe number
    gl_FragColor = vec4(uColor, soft * soft * vFade * 0.45);
}
`;

export function Dust({ color = '#ffdcae', radius }: { color?: string; radius: number }) {
    const geometry = useMemo(() => {
        const g = new BufferGeometry();
        const pos = new Float32Array(DUST_COUNT * 3), seed = new Float32Array(DUST_COUNT);
        for (let i = 0; i < DUST_COUNT; i++) {
            const outer = rimOuter(radius);
            pos.set([(Math.random() - 0.5) * outer * 1.8, 0.5 + Math.random() * 5, (Math.random() - 0.5) * outer * 1.8], i * 3);
            seed[i] = Math.random();
        }
        g.setAttribute('position', new BufferAttribute(pos, 3));
        g.setAttribute('aSeed', new BufferAttribute(seed, 1));
        return g;
    }, [radius]);
    const material = useMemo(() => new ShaderMaterial({
        uniforms: { uTime: waterTime, uColor: { value: new Color(color) } },
        vertexShader: DUST_VERTEX, fragmentShader: DUST_FRAGMENT,
        transparent: true, depthWrite: false, blending: AdditiveBlending,
    }), []);
    useEffect(() => { material.uniforms.uColor.value.set(color); }, [color, material]);
    useEffect(() => () => { geometry.dispose(); material.dispose(); }, [geometry, material]);
    return <points geometry={geometry} material={material} frustumCulled={false} raycast={() => null} />;
}

// A torch: a short post on top of a wall with a flickering flame and its light
function Torch({ hex }: { hex: Hex }) {
    const [x, , z] = hexToWorld(hex, 1);
    const top = wallTop(hex);
    const flame = useRef<Mesh>(null);
    const light = useRef<PointLight>(null);
    const seed = fixedRandom(hex, 51) * 100;     // each torch flickers in its own rhythm
    useFrame(({ clock }) => {
        const t = clock.elapsedTime + seed;
        // several wobbles at odd speeds added together never quite repeat, so it reads as fire
        const flicker = 0.8 + 0.12 * Math.sin(t * 7.3) + 0.06 * Math.sin(t * 13.1) + 0.05 * Math.sin(t * 23.7);
        if (light.current) light.current.intensity = 9 * flicker;
        if (flame.current) flame.current.scale.set(0.09 * flicker, 0.16 * flicker, 0.09 * flicker);
    });
    return (
        <group position={[x, top, z]}>
            <mesh position={[0, 0.12, 0]} castShadow>
                <cylinderGeometry args={[0.035, 0.045, 0.24, 8]} />
                <meshStandardMaterial color="#3b2a1c" roughness={0.9} />
            </mesh>
            <mesh ref={flame} position={[0, 0.3, 0]}>
                <sphereGeometry args={[1, 12, 12]} />
                {/* brighter than white on purpose: that's what makes the glow (bloom) pick it up */}
                <meshBasicMaterial color={[4, 1.8, 0.5]} toneMapped={false} />
            </mesh>
            <pointLight ref={light} position={[0, 0.35, 0]} color="#ff9a45" distance={7} decay={2} intensity={9} />
        </group>
    );
}

const MAX_TORCHES = 4;      // each torch is a real light, so keep a handful

// Torches on a few walls (the same walls on every screen, so they don't jump when someone repaints elsewhere)
export function Torches({ terrain }: { terrain: Record<string, string> }) {
    const spots = useMemo(() => {
        const walls = Object.keys(terrain).filter((key) => terrain[key] === 'block').map((key) => {
            const [q, r] = key.split(',').map(Number);
            return { q, r };
        });
        return walls
            .map((hex) => ({ hex, pick: fixedRandom(hex, 50) }))
            .sort((a, b) => a.pick - b.pick)           // a fixed "random" order...
            .slice(0, Math.min(MAX_TORCHES, Math.ceil(walls.length / 6)))   // ...about one torch per six wall hexes, at most a few
            .map((w) => w.hex);
    }, [terrain]);
    return <>{spots.map((hex) => <Torch key={`${hex.q},${hex.r}`} hex={hex} />)}</>;
}
