// Hand-made looks for the board, drawn by small additions to three.js's own materials (no pictures needed):
//   paintTiles : hex tiles look hand-painted: soft colour mottling across the board, a darker rim on every hex,
//                and each hex a touch lighter or darker than its neighbours
//   paintStone : the same mottling without the hex rim (walls, rocks)
//   waterLook  : moving ripples that catch the light, and deeper/shallower patches that drift slowly
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

const DEPTH = /* glsl */ `
diffuseColor.rgb *= 0.8 + 0.4 * pFbm(vPaintPos.xz * 0.5 + uWaterTime * 0.03);   // deeper and shallower patches, drifting
`;

export function waterLook(shader: Shader) {
    shader.uniforms.uWaterTime = waterTime;
    addWhere(shader);
    shader.fragmentShader = 'uniform float uWaterTime;\n' + shader.fragmentShader
        .replace('#include <color_fragment>', '#include <color_fragment>\n' + DEPTH)
        .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + RIPPLES);
}

