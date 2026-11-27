// The Natural board style (T3): one ground across the whole board instead of hex tiles. Each hex still has its own
// look, but neighbouring looks blend softly into each other (a "splat map": how much of each picture shows at every
// spot), with a wobble so borders look like nature, not straight lines. No hex edges are drawn.
//   - the pictures are the Poly Haven ground sets (T2, groundTextures.ts), only the ones this board uses (16 at most)
//   - raised ground (heights) rises and falls smoothly, exactly at each hex's height in its middle
//   - water (deep) is its own surface: clear by the shore with foam, darker further out; the ground under it dips
//   - ice (slick) is glassy with white cracks and frost over whatever ground is under it
// How it works: a small picture with one pixel per hex (hexData: which ground, water depth, ice, height) goes to the
// graphics card. For every pixel of the ground the shader finds the nearest hexes and mixes their pictures by distance.
import { useEffect, useMemo } from 'react'
import { useTexture } from '@react-three/drei'
import { type Hex, hexKey, neighbors, distance, isSurface, DEFAULT_SURFACE, STEEP_RISE } from '@tenebris/rules/board'
import {
    DataTexture, DataArrayTexture, MeshStandardMaterial, MeshPhysicalMaterial, PlaneGeometry, RGBAFormat, UnsignedByteType,
    NearestFilter, LinearFilter, LinearMipmapLinearFilter, RepeatWrapping, SRGBColorSpace, type Texture, type Material,
} from 'three'
import { surfaceSet, TERRAIN_SETS, textureUrl, type GroundSet } from './groundTextures.ts'
import { useGraphics } from './graphicsSettings.ts'
import { NOISE_GLSL, WHERE_GLSL, ICE_COLOUR, ICE_ROUGHNESS, WATER_COLOUR, WATER_FOAM, WATER_RIPPLES, waterTime } from './boardLooks.ts'

type Shader = Parameters<Material['onBeforeCompile']>[0];

export const MAX_GROUND_LAYERS = 16;   // Gabriel's limit: 16 ground pictures per board
const PICTURE_SIZE_HIGH = 2048;        // High: 2K ground pictures
const PICTURE_SIZE_LOW = 1024;         // Medium and Low: 1K
const TEXTURE_SCALE = 4;               // one copy of a picture covers 4 x 4 world units (about two hexes)
const HEIGHT_STEP = 0.35;              // the same as HEIGHT_STEP in TableScenery.tsx (one level of raised ground)
const WATER_DIP = 0.12;                // how far the ground sinks under water
const GROUND_TOP = 0.1;                // a flat hex's top (tiles sit from -0.1 to 0.1), so tokens stand at the same height

const folderOf = (set: GroundSet) => (set.type === 'photo' ? set.folder : null);

// Which picture a hex shows: walls, rough and steep ground have their own; otherwise its surface. Ground that drops
// STEEP_RISE levels or more to a neighbour shows the cliff picture.
function groundFolder(hex: Hex, terrain: Record<string, string>, surfaces: Record<string, string>, heights: Record<string, number>): string {
    const key = hexKey(hex);
    const rule = terrain[key];
    if (rule === 'block' || rule === 'rough' || rule === 'steep') return folderOf(TERRAIN_SETS[rule]) ?? 'surfaces/grass';
    const height = heights[key] ?? 0;
    if (neighbors(hex).some((n) => height - (heights[hexKey(n)] ?? 0) >= STEEP_RISE)) return folderOf(TERRAIN_SETS.steep) ?? 'surfaces/grass';
    const surface = isSurface(surfaces[key]) ? surfaces[key] : DEFAULT_SURFACE;
    return surfaceSet(surface).folder;
}

// The pictures this board needs (the default first), and which one each hex uses
function planGround(hexes: Hex[], terrain: Record<string, string>, surfaces: Record<string, string>, heights: Record<string, number>) {
    const layers = [surfaceSet(DEFAULT_SURFACE).folder];
    const layerOf = new Map<string, number>();
    for (const hex of hexes) {
        const folder = groundFolder(hex, terrain, surfaces, heights);
        let i = layers.indexOf(folder);
        if (i < 0 && layers.length < MAX_GROUND_LAYERS) { layers.push(folder); i = layers.length - 1; }
        layerOf.set(hexKey(hex), Math.max(0, i));
    }
    return { layers, layerOf };
}

// One pixel per hex: R = picture layer, G = water depth (0 = land, 80/160/240 = 1/2/3+ hexes from the shore),
// B = ice (255), A = height level x 40. The edge is one hex wider than the board, so the blend has neighbours there.
function buildHexData(hexes: Hex[], radius: number, layerOf: Map<string, number>, terrain: Record<string, string>, heights: Record<string, number>) {
    const offset = radius + 1, size = 2 * radius + 3;
    const data = new Uint8Array(size * size * 4);
    const water = new Set(hexes.filter((h) => terrain[hexKey(h)] === 'deep').map(hexKey));
    const depth = new Map<string, number>();
    let ring = hexes.filter((h) => water.has(hexKey(h)) && neighbors(h).some((n) => !water.has(hexKey(n))));
    for (let d = 1; ring.length > 0; d++) {
        for (const h of ring) depth.set(hexKey(h), Math.min(d, 3));
        ring = [...new Map(ring.flatMap(neighbors).filter((n) => water.has(hexKey(n)) && !depth.has(hexKey(n))).map((n) => [hexKey(n), n])).values()];
    }
    for (const hex of hexes) {
        const key = hexKey(hex);
        const i = ((hex.r + offset) * size + (hex.q + offset)) * 4;
        data[i] = layerOf.get(key) ?? 0;
        data[i + 1] = (depth.get(key) ?? 0) * 80;
        data[i + 2] = terrain[key] === 'slick' ? 255 : 0;
        data[i + 3] = Math.max(0, Math.min(6, heights[key] ?? 0)) * 40;
    }
    const texture = new DataTexture(data, size, size, RGBAFormat, UnsignedByteType);
    texture.magFilter = texture.minFilter = NearestFilter;
    texture.needsUpdate = true;
    return { texture, offset, size };
}

// The board's pictures stacked into two layered textures: colour (+ roughness in alpha) and normal
function buildPictureStacks(textures: Texture[], layers: number, pictureSize: number) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = pictureSize;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('No 2D canvas for the ground pictures');
    const pixels = (image: CanvasImageSource) => {
        ctx.setTransform(1, 0, 0, -1, 0, pictureSize);            // bottom row first, like the graphics card expects
        ctx.drawImage(image, 0, 0, pictureSize, pictureSize);
        return ctx.getImageData(0, 0, pictureSize, pictureSize).data;
    };
    const area = pictureSize * pictureSize;
    const colour = new Uint8Array(area * 4 * layers), normal = new Uint8Array(area * 4 * layers);
    for (let l = 0; l < layers; l++) {
        const c = pixels(textures[l * 3].image as CanvasImageSource);
        const n = pixels(textures[l * 3 + 1].image as CanvasImageSource);
        const r = pixels(textures[l * 3 + 2].image as CanvasImageSource);
        const base = l * area * 4;
        for (let p = 0; p < area * 4; p += 4) {
            colour[base + p] = c[p]; colour[base + p + 1] = c[p + 1]; colour[base + p + 2] = c[p + 2]; colour[base + p + 3] = r[p];
            normal[base + p] = n[p]; normal[base + p + 1] = n[p + 1]; normal[base + p + 2] = n[p + 2]; normal[base + p + 3] = 255;
        }
    }
    const stack = (data: Uint8Array, srgb: boolean) => {
        const t = new DataArrayTexture(data, pictureSize, pictureSize, layers);
        t.format = RGBAFormat;
        t.type = UnsignedByteType;
        if (srgb) t.colorSpace = SRGBColorSpace;            // only the colour is a colour; roughness (alpha) stays as it is
        t.wrapS = t.wrapT = RepeatWrapping;
        t.magFilter = LinearFilter;
        t.minFilter = LinearMipmapLinearFilter;
        t.generateMipmaps = true;
        t.anisotropy = 8;
        t.needsUpdate = true;
        return t;
    };
    return { colour: stack(colour, true), normal: stack(normal, false) };
}

// ---- the shaders ----

// Shared: find hexes from a world position, read a hex's pixel, and how much a hex counts at a spot
const HEX_GLSL = /* glsl */ `
uniform sampler2D uHexData;
uniform float uHexOffset;
uniform float uHexSize;
uniform float uHeightStep;
uniform float uWaterDip;
uniform float uRimApothem;
const float HSQRT3 = 1.7320508;
const vec2 HEX_STEPS[7] = vec2[7](vec2(0.0), vec2(1.0, 0.0), vec2(1.0, -1.0), vec2(0.0, -1.0), vec2(-1.0, 0.0), vec2(-1.0, 1.0), vec2(0.0, 1.0));
vec2 hexCentre(vec2 qr) { return vec2(1.5 * qr.x, HSQRT3 * (qr.y + qr.x * 0.5)); }
vec2 hexOfPoint(vec2 p) {
    float q = (2.0 / 3.0) * p.x;
    float r = p.y / HSQRT3 - p.x / 3.0;
    float s = -q - r;
    float rq = floor(q + 0.5), rr = floor(r + 0.5), rs = floor(s + 0.5);
    float dq = abs(rq - q), dr = abs(rr - r), ds = abs(rs - s);
    if (dq > dr && dq > ds) rq = -rr - rs; else if (dr > ds) rr = -rq - rs;
    return vec2(rq, rr);
}
vec4 hexPixel(vec2 qr) { return textureLod(uHexData, (qr + uHexOffset + 0.5) / uHexSize, 0.0) * 255.0; }
// 1 in a hex's middle, 0 from the next hex's middle on (so the middle is always exactly that hex)
float hexReach(vec2 p, vec2 qr, float wobble) {
    float w = clamp(1.0 - length(p - hexCentre(qr)) / HSQRT3 + wobble, 0.0, 1.0);
    return w * w;
}
float isWater(vec4 h) { return step(1.0, h.g); }
float groundY(vec2 p, float dip) {
    vec2 c = hexOfPoint(p);
    float sum = 0.0, total = 0.0;
    for (int i = 0; i < 7; i++) {
        vec2 qr = c + HEX_STEPS[i];
        float w = hexReach(p, qr, 0.0);
        if (w <= 0.0) continue;
        vec4 h = hexPixel(qr);
        sum += w * (h.a / 40.0 * uHeightStep - dip * isWater(h));
        total += w;
    }
    return sum / max(total, 1e-4);
}
vec3 groundNormalAt(vec2 p, float dip) {
    float e = 0.15;
    float l = groundY(p - vec2(e, 0.0), dip), r = groundY(p + vec2(e, 0.0), dip);
    float d = groundY(p - vec2(0.0, e), dip), u = groundY(p + vec2(0.0, e), dip);
    return normalize(vec3(l - r, 2.0 * e, d - u));
}
`;

function shapeGround(shader: Shader, dip: string, lift: string) {
    shader.vertexShader = 'varying vec3 vGroundN;\n' + shader.vertexShader
        .replace('void main() {', HEX_GLSL + 'void main() {')
        .replace('#include <beginnormal_vertex>', `vec3 objectNormal = groundNormalAt(position.xz, ${dip});\nvGroundN = objectNormal;`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>\ntransformed.y = groundY(position.xz, ${dip}) + ${lift};`)
        .replace('#include <project_vertex>', WHERE_GLSL);
    shader.vertexShader = 'varying vec3 vPaintPos;\nvarying vec2 vPaintCenter;\n' + shader.vertexShader;
}

// How much each nearby hex counts at this spot, with its own wobble so borders wander like real ground does
// (two sizes of wobble: big bays and small frayed edges).
const NEAR_HEXES = /* glsl */ `
vec2 np = vPaintPos.xz;
vec2 rimP = abs(np);
if (max(rimP.x, dot(rimP, vec2(0.5, 0.8660254))) > uRimApothem) discard;     // stop at the wooden rim
vec2 nc = hexOfPoint(np);
vec2 nearQr[7];
float nearW[7];
float nearTotal = 0.0;
for (int i = 0; i < 7; i++) {
    vec2 qr = nc + HEX_STEPS[i];
    float wobble = (pFbm(np * 0.7 + qr * 7.31) - 0.5) * 0.6 + (pFbm(np * 3.1 + qr * 3.17) - 0.5) * 0.25;
    float w = hexReach(np, qr, wobble);
    nearQr[i] = qr;
    nearW[i] = w;
    nearTotal += w;
}
nearTotal = max(nearTotal, 1e-4);
`;

const GROUND_COLOUR = /* glsl */ `
// uLayerKind: 0 = ordinary, 1 = snow, 2 = grass (so each can be treated a little differently)
float snowAmt = 0.0;
for (int i = 0; i < 7; i++) {
    float w = nearW[i] / nearTotal;
    if (w <= 0.001) continue;
    float kind0 = uLayerKind[int(clamp(floor(hexPixel(nearQr[i]).r + 0.5), 0.0, 15.0))];
    if (kind0 > 0.5 && kind0 < 1.5) snowAmt += w;
}
vec4 gCol = vec4(0.0);
vec3 gNor = vec3(0.0);
float iceAmount = 0.0, gWet = 0.0, wSum = 0.0;
for (int i = 0; i < 7; i++) {
    float w = nearW[i] / nearTotal;
    if (w <= 0.001) continue;
    vec4 h = hexPixel(nearQr[i]);
    int li = int(clamp(floor(h.r + 0.5), 0.0, 15.0));
    float kind = uLayerKind[li];
    float isSnow = step(0.5, kind) * step(kind, 1.5);
    float isGrass = step(1.5, kind) * step(kind, 2.5);
    float scale = uTextureScale * mix(1.0, 2.5, isSnow);   // snow uses a larger repeat so footprints don't tile
    vec2 uv = np / scale;
    vec4 samp;
    vec3 nor;
    if (isSnow > 0.5) {
        vec2 uvB = vec2(uv.x * 0.743 - uv.y * 0.669, uv.x * 0.669 + uv.y * 0.743) + vec2(0.37, 0.19);
        float bomb = pFbm(np * 0.18);
        vec4 a = textureGrad(uGroundColour, vec3(uv, float(li)), dFdx(uv), dFdy(uv));
        vec4 b = textureGrad(uGroundColour, vec3(uvB, float(li)), dFdx(uvB), dFdy(uvB));
        samp = mix(a, b, bomb);
        // lift and cool: the table's warm lamp would otherwise turn white snow pink
        samp.rgb = mix(samp.rgb, vec3(0.93, 0.96, 1.0), 0.42);
        samp.rgb = min(samp.rgb * vec3(0.98, 1.0, 1.06) + vec3(0.04, 0.045, 0.06), vec3(1.0));
        samp.a = mix(samp.a, 0.72, 0.35);
        vec3 na = textureGrad(uGroundNormal, vec3(uv, float(li)), dFdx(uv), dFdy(uv)).xyz * 2.0 - 1.0;
        vec3 nb = textureGrad(uGroundNormal, vec3(uvB, float(li)), dFdx(uvB), dFdy(uvB)).xyz * 2.0 - 1.0;
        nor = mix(na, nb, bomb);
    } else {
        vec2 gdx = dFdx(uv), gdy = dFdy(uv);
        samp = textureGrad(uGroundColour, vec3(uv, float(li)), gdx, gdy);
        nor = textureGrad(uGroundNormal, vec3(uv, float(li)), gdx, gdy).xyz * 2.0 - 1.0;
        if (isGrass > 0.5) {
            float luma = dot(samp.rgb, vec3(0.3, 0.59, 0.11));
            vec3 green = vec3(0.18, 0.44, 0.12) * (0.5 + luma);
            samp.rgb = mix(samp.rgb, green, 0.55) * vec3(0.70, 1.18, 0.52);
        }
    }
    // snow wins the blend: dark neighbour ground (dirt, dry grass) must not smear in as brown blotches
    if (isSnow < 0.5 && snowAmt > 0.01) {
        float luma = dot(samp.rgb, vec3(0.3, 0.59, 0.11));
        w *= mix(1.0, 0.12, clamp(snowAmt * (1.0 - luma) * 1.4, 0.0, 1.0));
    }
    gCol += w * samp;
    gNor += w * nor;
    iceAmount += w * step(128.0, h.b);
    gWet += w * isWater(h);
    wSum += w;
}
gCol /= max(wSum, 1e-4);
gNor /= max(wSum, 1e-4);
gWet /= max(wSum, 1e-4);
iceAmount /= max(wSum, 1e-4);
diffuseColor.rgb *= gCol.rgb;
diffuseColor.rgb *= 1.0 - 0.45 * gWet;            // wet and darker under the water
float groundRough = gCol.a;
vec3 groundTs = normalize(vec3(gNor.xy, max(gNor.z, 0.2)));
iceAmount = smoothstep(0.2, 0.6, iceAmount);
`;

const GROUND_NORMAL = /* glsl */ `
vec3 gN = normalize(vGroundN);
vec3 gT = normalize(vec3(1.0, 0.0, 0.0) - gN * gN.x);
vec3 gB = cross(gT, gN);
vec3 gWorldN = normalize(gT * groundTs.x + gB * groundTs.y + gN * groundTs.z);
gWorldN = normalize(mix(gWorldN, gN, iceAmount * 0.7));      // ice is smooth
normal = normalize((viewMatrix * vec4(gWorldN, 0.0)).xyz);
`;

const WATER_HERE = /* glsl */ `
float wAmt = 0.0, wDepthSum = 0.0;
for (int i = 0; i < 7; i++) {
    float w = nearW[i] / nearTotal;
    if (w <= 0.001) continue;
    vec4 h = hexPixel(nearQr[i]);
    float wet = isWater(h);
    wAmt += w * wet;
    wDepthSum += w * wet * clamp((h.g / 80.0 - 1.0) / 2.0, 0.0, 1.0);
}
float wDepth = wDepthSum / max(wAmt, 1e-4);
float wFoam = 1.0 - smoothstep(0.0, 0.28, abs(wAmt - 0.5));
`;

type Uniforms = Record<string, { value: unknown }>;

function groundLook(uniforms: Uniforms) {
    return (shader: Shader) => {
        Object.assign(shader.uniforms, uniforms);
        shapeGround(shader, 'uWaterDip', `${GROUND_TOP.toFixed(3)}`);
        shader.fragmentShader = 'varying vec3 vGroundN;\nuniform highp sampler2DArray uGroundColour;\nuniform highp sampler2DArray uGroundNormal;\nuniform float uTextureScale;\nuniform float uLayerKind[16];\n'
            + NOISE_GLSL + shader.fragmentShader
                .replace('void main() {', HEX_GLSL + 'void main() {')
                .replace('#include <map_fragment>', '#include <map_fragment>\n' + NEAR_HEXES + GROUND_COLOUR + ICE_COLOUR)
                .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = groundRough;\n' + ICE_ROUGHNESS)
                .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + GROUND_NORMAL);
    };
}

function naturalWaterLook(uniforms: Uniforms) {
    return (shader: Shader) => {
        Object.assign(shader.uniforms, uniforms);
        shader.uniforms.uWaterTime = waterTime;
        shapeGround(shader, '0.0', `${(GROUND_TOP + 0.005).toFixed(3)}`);
        shader.fragmentShader = 'varying vec3 vGroundN;\nuniform float uWaterTime;\n' + NOISE_GLSL + shader.fragmentShader
            .replace('void main() {', HEX_GLSL + 'void main() {')
            .replace('#include <color_fragment>', '#include <color_fragment>\n' + NEAR_HEXES + WATER_HERE + WATER_COLOUR + WATER_FOAM
                + 'diffuseColor.a *= smoothstep(0.28, 0.5, wAmt);\nif (diffuseColor.a < 0.01) discard;\n')
            .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + WATER_RIPPLES);
    };
}

type NaturalProps = {
    hexes: Hex[];
    terrain: Record<string, string>;
    surfaces: Record<string, string>;
    heights: Record<string, number>;
    radius: number;
};

// The Natural ground: loads only this board's pictures (it suspends until they're ready: wrap it in Suspense)
export function NaturalGround({ hexes, terrain, surfaces, heights, radius }: NaturalProps) {
    const graphics = useGraphics();
    const pictureSize = graphics.textureQuality === '2k' ? PICTURE_SIZE_HIGH : PICTURE_SIZE_LOW;
    const plan = useMemo(() => planGround(hexes, terrain, surfaces, heights), [hexes, terrain, surfaces, heights]);
    const layerKey = plan.layers.join('|');
    const urls = useMemo(() => layerKey.split('|').flatMap((f) => [
        textureUrl(f, 'color', graphics.textureQuality),
        textureUrl(f, 'normal', graphics.textureQuality),
        textureUrl(f, 'rough', graphics.textureQuality),
    ]), [layerKey, graphics.textureQuality]);
    const pictures = useTexture(urls) as Texture[];
    const stacks = useMemo(() => buildPictureStacks(pictures, urls.length / 3, pictureSize), [pictures, urls, pictureSize]);
    useEffect(() => () => { stacks.colour.dispose(); stacks.normal.dispose(); }, [stacks]);

    const hexData = useMemo(() => buildHexData(hexes, radius, plan.layerOf, terrain, heights), [hexes, radius, plan, terrain, heights]);
    useEffect(() => () => hexData.texture.dispose(), [hexData]);

    // the uniforms live as long as the board; their values follow the board as it's painted
    const uniforms = useMemo<Uniforms>(() => ({
        uHexData: { value: null }, uHexOffset: { value: 0 }, uHexSize: { value: 1 },
        uHeightStep: { value: HEIGHT_STEP }, uWaterDip: { value: WATER_DIP }, uRimApothem: { value: 1 },
        uGroundColour: { value: null }, uGroundNormal: { value: null }, uTextureScale: { value: TEXTURE_SCALE },
        uLayerKind: { value: new Array(16).fill(0) },
    }), []);
    const kinds = new Array(16).fill(0);
    plan.layers.forEach((folder, i) => { kinds[i] = /snow/.test(folder) ? 1 : /(^|\/|_)grass/.test(folder) && !/cobble/.test(folder) ? 2 : 0; });
    uniforms.uLayerKind.value = kinds;
    uniforms.uHexData.value = hexData.texture;
    uniforms.uHexOffset.value = hexData.offset;
    uniforms.uHexSize.value = hexData.size;
    uniforms.uRimApothem.value = (radius * Math.sqrt(3) + 1.3) * 0.8660254;   // the rim's inside edge (rimInner in TableScenery.tsx)
    uniforms.uGroundColour.value = stacks.colour;
    uniforms.uGroundNormal.value = stacks.normal;

    const ground = useMemo(() => {
        const m = new MeshStandardMaterial({ color: 'white', roughness: 1, metalness: 0 });
        m.onBeforeCompile = groundLook(uniforms);
        return m;
    }, [uniforms]);
    const water = useMemo(() => {
        const m = new MeshPhysicalMaterial({ roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.05, transparent: true, depthWrite: false });
        m.onBeforeCompile = naturalWaterLook(uniforms);
        return m;
    }, [uniforms]);
    useEffect(() => () => { ground.dispose(); water.dispose(); }, [ground, water]);

    // one flat sheet over the board (laid flat in its own corners, so its positions are world positions), finely cut
    // so it can follow the heights
    const sheet = useMemo(() => {
        const width = 2 * (1.5 * radius + 2), depth = 2 * (Math.sqrt(3) * radius + 2);
        const g = new PlaneGeometry(width, depth, Math.ceil(width * 3), Math.ceil(depth * 3));
        g.rotateX(-Math.PI / 2);
        return g;
    }, [radius]);
    useEffect(() => () => sheet.dispose(), [sheet]);
    const hasWater = useMemo(() => hexes.some((h) => terrain[hexKey(h)] === 'deep'), [hexes, terrain]);

    return (
        <>
            <mesh geometry={sheet} material={ground} receiveShadow />
            {hasWater && <mesh geometry={sheet} material={water} renderOrder={1} />}
        </>
    );
}

// How far the board reaches, from its hexes (for callers that don't know the radius)
export const radiusOfHexes = (hexes: Hex[]) => hexes.reduce((m, h) => Math.max(m, distance({ q: 0, r: 0 }, h)), 0);
