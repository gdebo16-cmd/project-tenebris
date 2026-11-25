// The table's light and atmosphere (Stage 2 polish): a warm lamp hanging over the table, soft reflections, and the
// finishing touches a camera lens would add: ambient occlusion (soft darkness where things meet), a gentle glow on bright
// things, and a vignette. Plus small signs of life: dust drifting in the lamp light and torches flickering on walls.
// Made for the TV's graphics card; turn pieces off here if a smaller machine struggles.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Environment, Lightformer } from '@react-three/drei'
import { EffectComposer, N8AO, Bloom, Vignette, ToneMapping } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, ShaderMaterial, type Mesh, type PointLight } from 'three'
import { type Hex } from '@tenebris/rules/board'
import { hexToWorld, wallTop, fixedRandom, RIM_OUTER } from './TableScenery.tsx'
import { waterTime } from './boardLooks.ts'
import type { MoodLight } from './BoardWorld.tsx'

// how far the sun's shadows reach from the centre: the whole board and its rim
const SHADOW_REACH = RIM_OUTER + 3;

// ---- lights ----

export function BoardLights({ mood }: { mood: MoodLight }) {
    // keep the water moving (its shader reads this clock)
    useFrame((_, delta) => { waterTime.value += delta; });
    return (
        <>
            {/* soft reflections for shiny things (water, ice, the rim's varnish): a few glowing panels, no download */}
            <Environment resolution={256}>
                <Lightformer intensity={1.5} position={[0, 5, -2]} scale={[10, 3, 1]} color="#ffe2b8" />
                <Lightformer intensity={0.6} position={[-5, 1, 1]} scale={[3, 3, 1]} />
                <Lightformer intensity={0.6} position={[5, 1, 1]} scale={[3, 3, 1]} />
            </Environment>
            {/* the room: a little warm light from above, a little cool from below, so shadows are never pitch black */}
            <hemisphereLight args={[mood.sky, mood.ground, mood.roomPower]} />
            {/* the lamp over the table: warm, brightest in the middle, fading softly towards the rim (no shadows of its own) */}
            <spotLight position={[0, 24, 3]} angle={0.62} penumbra={0.9} decay={0} intensity={mood.lampPower} color={mood.lamp} />
            {/* the shadow light: high and a little to the side, its shadow area fitted to the board so edges stay crisp */}
            <directionalLight position={[6, 20, 9]} intensity={mood.sunPower} color={mood.sun} castShadow
                shadow-mapSize={[4096, 4096]} shadow-camera-near={1} shadow-camera-far={90}
                shadow-camera-left={-SHADOW_REACH} shadow-camera-right={SHADOW_REACH} shadow-camera-top={SHADOW_REACH} shadow-camera-bottom={-SHADOW_REACH}
                shadow-bias={-0.0003} shadow-normalBias={0.03} />
            {/* a faint second light from the side, so walls show their shape */}
            <directionalLight position={[-10, 8, -6]} intensity={mood.roomPower * 0.8} color="#bcd0ff" />
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

export function Dust({ color = '#ffdcae' }: { color?: string }) {
    const geometry = useMemo(() => {
        const g = new BufferGeometry();
        const pos = new Float32Array(DUST_COUNT * 3), seed = new Float32Array(DUST_COUNT);
        for (let i = 0; i < DUST_COUNT; i++) {
            pos.set([(Math.random() - 0.5) * RIM_OUTER * 1.8, 0.5 + Math.random() * 5, (Math.random() - 0.5) * RIM_OUTER * 1.8], i * 3);
            seed[i] = Math.random();
        }
        g.setAttribute('position', new BufferAttribute(pos, 3));
        g.setAttribute('aSeed', new BufferAttribute(seed, 1));
        return g;
    }, []);
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
        const walls = Object.keys(terrain).filter((key) => terrain[key] === 'wall').map((key) => {
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
