// T4: the hex grid as thin lines drawn by one ground shader (not as line objects).
// Uses the same flat-top hex sizes as @tenebris/rules. The DM can set it to on, faint or off;
// when it's off the sheet is not drawn, so moving, Measure and shapes are unchanged.
// Clicks go through the lines (raycast is off).
import { useEffect, useMemo } from 'react'
import { DataTexture, RGBAFormat, UnsignedByteType, NearestFilter, ShaderMaterial, PlaneGeometry, DoubleSide } from 'three'
import { hexesWithin, hexKey, type GridMode } from '@tenebris/rules/board'
import { HEIGHT_STEP } from './ground/hexMath.ts'

const GRID_LIFT = 0.102;      // a hair above a flat hex's top (tiles sit from -0.1 to 0.1)
const OPACITY = { on: 0.55, faint: 0.22, off: 0 } as const;

function buildHeightData(radius: number, heights: Record<string, number>) {
    const offset = radius + 1, size = 2 * radius + 3;
    const data = new Uint8Array(size * size * 4);
    for (const hex of hexesWithin({ q: 0, r: 0 }, radius)) {
        const i = ((hex.r + offset) * size + (hex.q + offset)) * 4;
        data[i] = 255;                                                    // this hex is on the board
        data[i + 3] = Math.max(0, Math.min(6, heights[hexKey(hex)] ?? 0)) * 40;
    }
    const texture = new DataTexture(data, size, size, RGBAFormat, UnsignedByteType);
    texture.magFilter = texture.minFilter = NearestFilter;
    texture.needsUpdate = true;
    return { texture, offset, size };
}

const VERT = /* glsl */ `
uniform sampler2D uHexData;
uniform float uHexOffset;
uniform float uHexSize;
uniform float uHeightStep;
uniform float uLift;
varying vec2 vWorld;
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
vec4 hexPixel(vec2 qr) { return texture2D(uHexData, (qr + uHexOffset + 0.5) / uHexSize) * 255.0; }
float groundY(vec2 p) {
    vec2 c = hexOfPoint(p);
    float sum = 0.0, total = 0.0;
    for (int i = 0; i < 7; i++) {
        vec2 qr = c + HEX_STEPS[i];
        vec2 dlt = p - hexCentre(qr);
        float w = clamp(1.0 - length(dlt) / HSQRT3, 0.0, 1.0);
        w = w * w;
        if (w <= 0.0) continue;
        sum += w * (hexPixel(qr).a / 40.0 * uHeightStep);
        total += w;
    }
    return sum / max(total, 1e-4);
}
void main() {
    vec3 p = position;
    p.y = groundY(p.xz) + uLift;
    vWorld = p.xz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`;

const FRAG = /* glsl */ `
uniform sampler2D uHexData;
uniform float uHexOffset;
uniform float uHexSize;
uniform float uRimApothem;
uniform float uOpacity;
varying vec2 vWorld;
const float HSQRT3 = 1.7320508;
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
vec4 hexPixel(vec2 qr) { return texture2D(uHexData, (qr + uHexOffset + 0.5) / uHexSize) * 255.0; }
void main() {
    vec2 p = vWorld;
    vec2 rimP = abs(p);
    if (max(rimP.x, dot(rimP, vec2(0.5, 0.8660254))) > uRimApothem) discard;
    vec2 qr = hexOfPoint(p);
    if (hexPixel(qr).r < 128.0) discard;
    vec2 local = p - hexCentre(qr);
    float edge = max(max(abs(dot(local, vec2(0.8660254, 0.5))), abs(local.y)), abs(dot(local, vec2(-0.8660254, 0.5)))) / 0.8660254;
    float line = smoothstep(0.93, 0.99, edge) * (1.0 - smoothstep(1.0, 1.035, edge));
    if (line < 0.01) discard;
    gl_FragColor = vec4(0.12, 0.09, 0.06, line * uOpacity);
}
`;

export function HexGrid({ radius, heights, mode }: { radius: number; heights: Record<string, number>; mode: GridMode }) {
    const hexData = useMemo(() => buildHeightData(radius, heights), [radius, heights]);
    useEffect(() => () => hexData.texture.dispose(), [hexData]);
    const material = useMemo(() => new ShaderMaterial({
        uniforms: {
            uHexData: { value: null },
            uHexOffset: { value: 0 },
            uHexSize: { value: 1 },
            uHeightStep: { value: HEIGHT_STEP },
            uLift: { value: GRID_LIFT },
            uRimApothem: { value: 1 },
            uOpacity: { value: 0.55 },
        },
        vertexShader: VERT,
        fragmentShader: FRAG,
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
    }), []);
    useEffect(() => () => material.dispose(), [material]);
    material.uniforms.uHexData.value = hexData.texture;
    material.uniforms.uHexOffset.value = hexData.offset;
    material.uniforms.uHexSize.value = hexData.size;
    material.uniforms.uRimApothem.value = (radius * Math.sqrt(3) + 1.3) * 0.8660254;
    material.uniforms.uOpacity.value = OPACITY[mode];
    const sheet = useMemo(() => {
        const width = 2 * (1.5 * radius + 2), depth = 2 * (Math.sqrt(3) * radius + 2);
        const g = new PlaneGeometry(width, depth, Math.ceil(width * 3), Math.ceil(depth * 3));
        g.rotateX(-Math.PI / 2);
        return g;
    }, [radius]);
    useEffect(() => () => sheet.dispose(), [sheet]);
    if (mode === 'off') return null;
    return <mesh geometry={sheet} material={material} frustumCulled={false} raycast={() => null} />;
}
