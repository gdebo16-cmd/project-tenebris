// The scene's world (Stage 2 polish), set by the DM per scene (look in the scene: mood, weather, room, map):
//   MOODS   : the light for day, dawn, dusk, night or a dungeon (used by BoardLights / BoardEffects)
//   Weather : drifting fog, rain or snow over the board
//   Room    : the table stands in a dim room, with candles at its corners, instead of felt going on forever
//   MapPicture : a picture the DM links (a painted battle map) laid over the hexes
// All looks only: none of it changes the rules.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { BufferAttribute, BufferGeometry, DoubleSide, type LineSegments, type Mesh, type Points,
    ShaderMaterial, SRGBColorSpace, TextureLoader, type Texture, Color } from 'three'
import type { SceneMood, SceneWeather, SceneMap } from '@tenebris/rules/board'
import { RIM_OUTER } from './TableScenery.tsx'
import { waterTime } from './boardLooks.ts'

// ---- moods: one set of light colours and strengths per mood ----
export type MoodLight = {
    background: string;                                  // the room around the board
    lamp: string; lampPower: number;                     // the warm lamp over the table
    sun: string; sunPower: number;                       // the light that casts the shadows (sun, moon, torchlight)
    sky: string; ground: string; roomPower: number;      // soft light from above and below
    dust: string; vignette: number;                      // dust colour, how dark the corners get
};
export const MOODS: Record<SceneMood, MoodLight> = {
    day:     { background: '#14110d', lamp: '#ffe6c4', lampPower: 1.4, sun: '#fff4e0', sunPower: 1.2, sky: '#ffe9cc', ground: '#2a3445', roomPower: 0.75, dust: '#ffdcae', vignette: 0.5 },
    dawn:    { background: '#1a1014', lamp: '#ffc9a0', lampPower: 1.1, sun: '#ffb88a', sunPower: 0.9, sky: '#ffd2b8', ground: '#3a2f3a', roomPower: 0.6, dust: '#ffd0b0', vignette: 0.55 },
    dusk:    { background: '#140c12', lamp: '#ff9e6a', lampPower: 1.0, sun: '#ff8a55', sunPower: 0.6, sky: '#9a7aa8', ground: '#2a2030', roomPower: 0.5, dust: '#ffb48a', vignette: 0.6 },
    night:   { background: '#030408', lamp: '#9fb6ff', lampPower: 0.22, sun: '#7d93d8', sunPower: 0.14, sky: '#3a4870', ground: '#06070c', roomPower: 0.16, dust: '#b8c8ff', vignette: 0.8 },
    dungeon: { background: '#020101', lamp: '#ffb070', lampPower: 0.16, sun: '#ffcf99', sunPower: 0.06, sky: '#2a221c', ground: '#050403', roomPower: 0.1, dust: '#ffcf99', vignette: 0.85 },
};
export const moodOf = (mood?: SceneMood) => MOODS[mood ?? 'day'] ?? MOODS.day;

// ---- weather ----

const AREA = RIM_OUTER * 2 + 12;   // the weather covers a square this wide, centred on the board (wider than the table)

// Rain: short streaks falling fast, slightly slanted. One shape for all the drops, moved every frame.
function Rain() {
    const COUNT = 2400;
    const lines = useRef<LineSegments>(null);
    const drops = useMemo(() => Array.from({ length: COUNT }, () => ({
        x: (Math.random() - 0.5) * AREA, y: Math.random() * 12, z: (Math.random() - 0.5) * AREA, speed: 18 + Math.random() * 8,
    })), []);
    const geometry = useMemo(() => {
        const g = new BufferGeometry();
        g.setAttribute('position', new BufferAttribute(new Float32Array(COUNT * 6), 3));
        return g;
    }, []);
    useEffect(() => () => geometry.dispose(), [geometry]);
    useFrame((_, delta) => {
        const pos = geometry.getAttribute('position') as BufferAttribute;
        drops.forEach((d, i) => {
            d.y -= d.speed * delta; d.x += delta * 1.5;
            if (d.y < 0.1) { d.y = 10 + Math.random() * 2; d.x = (Math.random() - 0.5) * AREA; d.z = (Math.random() - 0.5) * AREA; }
            pos.setXYZ(i * 2, d.x, d.y, d.z);
            pos.setXYZ(i * 2 + 1, d.x - 0.04, d.y + 0.45, d.z);       // the streak's tail
        });
        pos.needsUpdate = true;
    });
    return (
        <lineSegments ref={lines} geometry={geometry} frustumCulled={false}>
            <lineBasicMaterial color="#a8c0ff" transparent opacity={0.35} depthWrite={false} />
        </lineSegments>
    );
}

// Snow: soft flakes drifting down and swaying
function Snow() {
    const COUNT = 2600;
    const points = useRef<Points>(null);
    const flakes = useMemo(() => Array.from({ length: COUNT }, () => ({
        x: (Math.random() - 0.5) * AREA, y: Math.random() * 10, z: (Math.random() - 0.5) * AREA,
        speed: 0.6 + Math.random() * 0.6, phase: Math.random() * 6.28,
    })), []);
    const geometry = useMemo(() => {
        const g = new BufferGeometry();
        g.setAttribute('position', new BufferAttribute(new Float32Array(COUNT * 3), 3));
        return g;
    }, []);
    useEffect(() => () => geometry.dispose(), [geometry]);
    useFrame(({ clock }, delta) => {
        const pos = geometry.getAttribute('position') as BufferAttribute;
        const t = clock.elapsedTime;
        flakes.forEach((f, i) => {
            f.y -= f.speed * delta;
            if (f.y < 0.1) { f.y = 9 + Math.random(); f.x = (Math.random() - 0.5) * AREA; f.z = (Math.random() - 0.5) * AREA; }
            pos.setXYZ(i, f.x + Math.sin(t * 0.8 + f.phase) * 0.25, f.y, f.z + Math.cos(t * 0.6 + f.phase) * 0.2);
        });
        pos.needsUpdate = true;
    });
    return (
        <points ref={points} geometry={geometry} frustumCulled={false}>
            <pointsMaterial color="#ffffff" size={3} sizeAttenuation={false} transparent opacity={0.85} depthWrite={false} />
        </points>
    );
}

// Fog: a few big soft layers low over the board, slowly drifting (drawn with a little shader of its own)
const FOG_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const FOG_FRAGMENT = /* glsl */ `
uniform float uTime; uniform float uSeed; uniform vec3 uColor;
varying vec2 vUv;
float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(h(i), h(i + vec2(1, 0)), u.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), u.x), u.y); }
float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int k = 0; k < 4; k++) { v += a * n(p); p *= 2.0; a *= 0.5; } return v; }
void main() {
    vec2 p = vUv * 4.0 + vec2(uTime * 0.02 + uSeed, uTime * 0.013);
    float cloud = smoothstep(0.35, 0.85, fbm(p));
    float edge = smoothstep(0.5, 0.3, distance(vUv, vec2(0.5)));       // fade out towards the edges of the layer
    gl_FragColor = vec4(uColor, cloud * edge * 0.16);       // thin: the board must stay readable through it
}
`;
function FogLayer({ y, seed }: { y: number; seed: number }) {
    const material = useMemo(() => new ShaderMaterial({
        uniforms: { uTime: waterTime, uSeed: { value: seed }, uColor: { value: new Color('#dfe6ea') } },
        vertexShader: FOG_VERTEX, fragmentShader: FOG_FRAGMENT, transparent: true, depthWrite: false, side: DoubleSide,
    }), [seed]);
    useEffect(() => () => material.dispose(), [material]);
    return (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, y, 0]} material={material} raycast={() => null}>
            <planeGeometry args={[AREA * 1.2, AREA * 1.2]} />
        </mesh>
    );
}
function Fog() {
    return <>{[0.3, 0.8].map((y, i) => <FogLayer key={y} y={y} seed={i * 7.3} />)}</>;
}

export function Weather({ weather }: { weather?: SceneWeather }) {
    if (weather === 'rain') return <Rain />;
    if (weather === 'snow') return <Snow />;
    if (weather === 'fog') return <Fog />;
    return null;
}

// ---- the room: the table is a real piece of furniture in a dim room, with candles on its corners ----

const TABLE_RADIUS = RIM_OUTER + 4;

function Candle({ x, z, seed }: { x: number; z: number; seed: number }) {
    const flame = useRef<Mesh>(null);
    useFrame(({ clock }) => {
        const t = clock.elapsedTime + seed;
        const f = 0.85 + 0.1 * Math.sin(t * 8.1) + 0.05 * Math.sin(t * 19.7);
        flame.current?.scale.set(0.05 * f, 0.11 * f, 0.05 * f);
    });
    return (
        <group position={[x, -0.12, z]} scale={2.2}>
            <mesh position={[0, 0.25, 0]} castShadow>
                <cylinderGeometry args={[0.09, 0.1, 0.5, 12]} />
                <meshStandardMaterial color="#efe4cc" roughness={0.6} />
            </mesh>
            <mesh ref={flame} position={[0, 0.6, 0]}>
                <sphereGeometry args={[1, 10, 10]} />
                {/* brighter than white on purpose: the glow (bloom) picks it up, no real light needed */}
                <meshBasicMaterial color={[4, 2.2, 0.8]} toneMapped={false} />
            </mesh>
        </group>
    );
}

export function Room({ felt }: { felt: string }) {
    // the table: a thick hexagon slab; corners where the candles go
    const corners = useMemo(() => Array.from({ length: 6 }, (_, k) => {
        const a = Math.PI / 6 + (k * Math.PI) / 3;
        return [Math.cos(a) * (RIM_OUTER + 1.4), -Math.sin(a) * (RIM_OUTER + 1.4)] as const;   // just beyond the wooden rim
    }), []);
    return (
        <>
            <mesh position={[0, -0.72, 0]} receiveShadow castShadow rotation={[0, Math.PI / 6, 0]}>
                <cylinderGeometry args={[TABLE_RADIUS, TABLE_RADIUS, 1.2, 6]} />
                <meshStandardMaterial color={felt} roughness={0.95} />
            </mesh>
            {/* the floor far below, in deep shadow */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -14, 0]} receiveShadow>
                <planeGeometry args={[400, 400]} />
                <meshStandardMaterial color="#1b130d" roughness={1} />
            </mesh>
            {corners.map(([x, z], i) => <Candle key={i} x={x} z={z} seed={i * 3.1} />)}
        </>
    );
}

// ---- a map picture over the hexes ----

// Load the DM's picture. A broken link, or a site that doesn't allow its pictures to be used elsewhere, gives null.
function usePicture(url?: string) {
    const [texture, setTexture] = useState<Texture | null>(null);
    useEffect(() => {
        setTexture(null);
        if (!url) return;
        let current = true;
        const loader = new TextureLoader();
        loader.setCrossOrigin('anonymous');
        loader.load(url, (t) => { if (current) { t.colorSpace = SRGBColorSpace; t.anisotropy = 16; setTexture(t); } },
            undefined, () => { if (current) { console.warn('Map picture did not load:', url); setTexture(null); } });
        return () => { current = false; };
    }, [url]);
    return texture;
}

export function MapPicture({ map }: { map?: SceneMap | null }) {
    const picture = usePicture(map?.url);
    if (!map || !picture) return null;
    const img = picture.image as { width: number; height: number };
    const height = map.size * (img.height / img.width);
    return (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.1015, 0]} receiveShadow raycast={() => null}>
            <planeGeometry args={[map.size, height]} />
            <meshStandardMaterial map={picture} roughness={0.9} />
        </mesh>
    );
}

