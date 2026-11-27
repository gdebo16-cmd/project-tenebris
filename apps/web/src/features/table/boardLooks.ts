// Hand-made looks for the board, drawn by small additions to three.js's own materials (no pictures needed):
//   paintTiles : hex tiles look hand-painted: soft colour mottling across the board, a darker rim on every hex,
//                and each hex a touch lighter or darker than its neighbours
//   paintStone : the same mottling without the hex rim (walls, rocks)
//   waterLook  : custom water (T2): moving ripples that catch the light, shallow water clear and deep water dark,
//                foam along the shore. waterLookFor(depth, shore) makes one for water that deep.
//   iceLook    : custom ice (T2): glossy, with white cracks and frost that catch the light
// How it works: three.js builds each material's shader (the little program the graphics card runs per pixel) from
// pieces. onBeforeCompile lets us add a few lines to it before it's built. We work out where each pixel is in the world
// (vPaintPos), and colour or bend the light from there, so neighbouring hexes flow into each other.
import type { Material } from 'three'

type Shader = Parameters<Material['onBeforeCompile']>[0];

// Smooth "random" patterns (value noise, several sizes layered) for the graphics card
const NOISE = /* glsl */ `
varying vec3 vPaintPos;
varying vec2 vPaintCenter;
float pHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float pNoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(pHash(i), pHash(i + vec2(1.0, 0.0)), u.x), mix(pHash(i + vec2(0.0, 1.0)), pHash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float pFbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int k = 0; k < 4; k++) { v += a * pNoise(p); p *= 2.03; a *= 0.5; }
    return v;
}
// Cells (for ice cracks): x = distance to the nearest cell point, y = to the second nearest. A crack runs where they meet.
vec2 pCells(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    float d1 = 8.0, d2 = 8.0;
    for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
        vec2 g = vec2(float(x), float(y));
        vec2 o = vec2(pHash(i + g), pHash(i + g + 17.3));
        float d = length(g + o - f);
        if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
    }
    return vec2(d1, d2);
}
`;

// Where this corner is in the world (and the middle of its hex, for instanced tiles)
const WHERE = /* glsl */ `
#include <project_vertex>
vec4 paintWorld = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
    paintWorld = instanceMatrix * paintWorld;
    vPaintCenter = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xz;
#else
    vPaintCenter = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xz;
#endif
vPaintPos = (modelMatrix * paintWorld).xyz;
`;

// The same pieces for shaders built elsewhere (the Natural ground: TableNatural.tsx)
export const NOISE_GLSL = NOISE;
export const WHERE_GLSL = WHERE;

function addWhere(shader: Shader) {
    shader.vertexShader = 'varying vec3 vPaintPos;\nvarying vec2 vPaintCenter;\n' +
        shader.vertexShader.replace('#include <project_vertex>', WHERE);
    shader.fragmentShader = NOISE + shader.fragmentShader;
}

// Soft mottling: big gentle patches plus a finer grain
const MOTTLE = /* glsl */ `
vec2 pw = vPaintPos.xz;
float mottle = pFbm(pw * 1.3) * 0.6 + pFbm(pw * 5.0) * 0.4;
diffuseColor.rgb *= 0.82 + mottle * 0.36;
`;

// A darker rim inside every hex (flat-top: its sides face 30°, 90° and 150°), and a slight per-hex shade
const HEX_RIM = /* glsl */ `
vec2 local = vPaintPos.xz - vPaintCenter;
float edge = max(max(abs(dot(local, vec2(0.8660254, 0.5))), abs(local.y)), abs(dot(local, vec2(-0.8660254, 0.5)))) / 0.8660254;
edge += (pFbm(vPaintPos.xz * 3.1) - 0.5) * 0.22;        // a hand-drawn wobble along the edge
diffuseColor.rgb *= mix(1.0, 0.8, smoothstep(0.66, 1.05, edge));
diffuseColor.rgb *= 0.94 + pHash(floor(vPaintCenter * 10.0 + 0.5)) * 0.12;
`;

export function paintTiles(shader: Shader) {
    addWhere(shader);
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n' + MOTTLE + HEX_RIM);
}

export function paintStone(shader: Shader) {
    addWhere(shader);
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n' + MOTTLE);
}

// ---- water ----

// The water's clock, shared by every water material. BoardAtmosphere moves it forward every frame.
export const waterTime = { value: 0 };

const RIPPLES = /* glsl */ `
vec2 wp = vPaintPos.xz;
float tt = uWaterTime;
#define WAVES(p) (pFbm((p) * 0.45 + vec2(tt * 0.06, tt * 0.04)) + 0.35 * pFbm((p) * 1.1 - vec2(tt * 0.08, -tt * 0.05)))
float h0 = WAVES(wp);
float hx = WAVES(wp + vec2(0.15, 0.0));
float hz = WAVES(wp + vec2(0.0, 0.15));
vec3 rippleUp = normalize(vec3(-(hx - h0) / 0.15 * 0.18, 1.0, -(hz - h0) / 0.15 * 0.18));   // 0.18 = how strong the ripples are
normal = normalize((viewMatrix * vec4(rippleUp, 0.0)).xyz);   // the surface now tilts with the ripples, so it catches the light
`;

// How deep the water looks. wDeep: 0 at the shore up to 1 three hexes out. Shallow water is clear (the ground shows
// through), deep water dark and solid. (Shared with the Natural ground's water: TableNatural.tsx.)
export const WATER_COLOUR = /* glsl */ `
float wDeep = clamp(wDepth, 0.0, 1.0);
diffuseColor.rgb = mix(vec3(0.24, 0.55, 0.58), vec3(0.03, 0.13, 0.24), wDeep);
diffuseColor.rgb *= 0.85 + 0.3 * pFbm(vPaintPos.xz * 0.5 + uWaterTime * 0.03);   // deeper and shallower patches, drifting
diffuseColor.a = mix(0.42, 0.96, wDeep);
`;

// White foam: wFoam (0..1) says how close to the shore this pixel is. The foam breaks up and moves with the water.
export const WATER_FOAM = /* glsl */ `
float foamNoise = pFbm(vPaintPos.xz * 3.5 + vec2(uWaterTime * 0.25, -uWaterTime * 0.18));
float foamLine = smoothstep(0.55, 0.85, wFoam + (foamNoise - 0.5) * 0.45);
foamLine *= 0.65 + 0.35 * sin(uWaterTime * 1.3 + foamNoise * 6.0);                 // it laps in and out
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.9, 0.95, 0.96), foamLine);
diffuseColor.a = max(diffuseColor.a, foamLine);
`;

// Tiles: a water hex's own depth (uWaterDepth) and, for a shore hex, foam towards its edge
const TILE_WATER = /* glsl */ `
float wDepth = uWaterDepth;
vec2 wLocal = vPaintPos.xz - vPaintCenter;
float wEdge = max(max(abs(dot(wLocal, vec2(0.8660254, 0.5))), abs(wLocal.y)), abs(dot(wLocal, vec2(-0.8660254, 0.5)))) / 0.8660254;
float wFoam = uWaterShore * smoothstep(0.5, 1.0, wEdge);
` + WATER_COLOUR + WATER_FOAM;

// Water depth: 0 = shore .. 1 = deep. shore: foam along the edges (hexes next to land).
export function waterLookFor(depth: number, shore: boolean) {
    return (shader: Shader) => {
        shader.uniforms.uWaterTime = waterTime;
        shader.uniforms.uWaterDepth = { value: depth };
        shader.uniforms.uWaterShore = { value: shore ? 1 : 0 };
        addWhere(shader);
        shader.fragmentShader = 'uniform float uWaterTime;\nuniform float uWaterDepth;\nuniform float uWaterShore;\n' + shader.fragmentShader
            .replace('#include <color_fragment>', '#include <color_fragment>\n' + TILE_WATER)
            .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + RIPPLES);
    };
}
export const waterLook = waterLookFor(1, false);
export const WATER_RIPPLES = RIPPLES;

// ---- ice (T2): custom, not a picture ----
// iceAmount (0..1): how much ice covers this pixel. Cracks and frost are white and rougher; the rest is glassy.
export const ICE_COLOUR = /* glsl */ `
vec2 iceCells = pCells(vPaintPos.xz * 1.4);
float iceCrack = 1.0 - smoothstep(0.0, 0.06, iceCells.y - iceCells.x);
float iceFrost = smoothstep(0.45, 0.85, pFbm(vPaintPos.xz * 2.6));
vec3 iceTint = mix(vec3(0.62, 0.82, 0.92), vec3(0.95, 0.98, 1.0), clamp(iceCrack * 0.85 + iceFrost * 0.5, 0.0, 1.0));
diffuseColor.rgb = mix(diffuseColor.rgb, iceTint, iceAmount * 0.85);
`;
export const ICE_ROUGHNESS = /* glsl */ `
roughnessFactor = mix(roughnessFactor, 0.06 + 0.5 * clamp(iceCrack + iceFrost * 0.6, 0.0, 1.0), iceAmount);
`;

export function iceLook(shader: Shader) {
    addWhere(shader);
    shader.fragmentShader = shader.fragmentShader
        .replace('#include <color_fragment>', '#include <color_fragment>\nfloat iceAmount = 1.0;\n' + ICE_COLOUR)
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n' + ICE_ROUGHNESS);
}

