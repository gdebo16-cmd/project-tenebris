// Rebuild a Poly Haven tree's tiny needle/leaf geometry into fewer, larger
// double-sided MASK cards textured from the official twig atlas, keeping the
// trunk and branch silhouette. Used before `npm run model`.
//
//   node scripts/rebuild-foliage-cards.mjs <file.gltf> --out <out.glb>
//     [--variant a] [--target-cards 7000] [--silhouette <png>]
import fs from 'node:fs';
import path from 'node:path';
import { NodeIO, Document } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { flatten, prune, getBounds, getGLPrimitiveCount } from '@gltf-transform/functions';
import sharp from 'sharp';

const args = process.argv.slice(2);
function valueOf(flag, fallback) {
    const i = args.indexOf(flag);
    if (i < 0 || i + 1 >= args.length) return fallback;
    return args[i + 1];
}
const flags = new Set(args.filter((a) => a.startsWith('--') && !['--out', '--variant', '--target-cards', '--silhouette', '--alpha'].includes(a)));
const inputPath = args.find((a) => !a.startsWith('--') && a !== valueOf('--out') && a !== valueOf('--variant') && a !== valueOf('--target-cards') && a !== valueOf('--silhouette') && a !== valueOf('--alpha'));
const outPath = valueOf('--out');
const variantArg = String(valueOf('--variant', 'a')).toLowerCase();
const targetCards = Math.max(200, Number(valueOf('--target-cards', '7000')) || 7000);
const silhouettePath = valueOf('--silhouette', '');
const alphaOverride = valueOf('--alpha', '');

if (!inputPath || !outPath) {
    console.error('Usage: node scripts/rebuild-foliage-cards.mjs <file.gltf> --out <out.glb> [--variant a] [--target-cards 7000] [--silhouette out.png]');
    process.exit(1);
}

const FOLIAGE_RE = /leaf|twig|needl|foliage|grass|fern|petal|moss|shrub|nettle|plant|celand|dandel/i;

function isFoliagePrimitive(prim) {
    const mat = prim.getMaterial();
    if (!mat) return false;
    const mode = mat.getAlphaMode();
    if (mode === 'MASK' || mode === 'BLEND') return true;
    return FOLIAGE_RE.test(mat.getName() || '');
}

function variantKeyFromName(name) {
    const m = String(name || '').toLowerCase().match(/_([a-z])(?:_lod\d+)?$/);
    return m ? m[1] : null;
}

function usedBufferViews(gltf, nodeIndices) {
    const meshIds = new Set();
    for (const i of nodeIndices) {
        const n = gltf.nodes[i];
        if (n && n.mesh != null) meshIds.add(n.mesh);
    }
    const accIds = new Set();
    for (const mi of meshIds) {
        const mesh = gltf.meshes[mi];
        for (const prim of mesh.primitives || []) {
            if (prim.indices != null) accIds.add(prim.indices);
            for (const a of Object.values(prim.attributes || {})) accIds.add(a);
        }
    }
    const bvIds = new Set();
    for (const ai of accIds) {
        const acc = gltf.accessors[ai];
        if (acc && acc.bufferView != null) bvIds.add(acc.bufferView);
    }
    return { meshIds, accIds, bvIds };
}

function trimGltfToVariants(gltfPath, variantKeys, destGltf) {
    const gltf = JSON.parse(fs.readFileSync(gltfPath, 'utf8'));
    const nodes = gltf.nodes || [];
    const selected = [];
    for (let i = 0; i < nodes.length; i++) {
        const key = variantKeyFromName(nodes[i].name);
        const want = variantKeys.includes('all') || variantKeys.includes(String(i)) || (key && variantKeys.includes(key));
        if (want) selected.push(i);
    }
    if (!selected.length) throw new Error('No nodes matched --variant ' + variantKeys.join(','));
    // If a single off-origin variant was picked, slide it back to the origin.
    if (selected.length === 1 && Array.isArray(nodes[selected[0]].translation)) {
        nodes[selected[0]].translation = [0, 0, 0];
    }
    const { meshIds, accIds, bvIds } = usedBufferViews(gltf, selected);
    const srcBinUri = gltf.buffers[0].uri;
    const srcBin = fs.readFileSync(path.join(path.dirname(gltfPath), srcBinUri));

    const bvOrder = [...bvIds].sort((a, b) => a - b);
    const bvMap = new Map();
    const chunks = [];
    let offset = 0;
    for (const id of bvOrder) {
        const bv = gltf.bufferViews[id];
        const start = bv.byteOffset || 0;
        const slice = srcBin.subarray(start, start + bv.byteLength);
        const padded = offset % 4 === 0 ? 0 : 4 - (offset % 4);
        offset += padded;
        chunks.push(Buffer.alloc(padded), slice);
        bvMap.set(id, { ...bv, buffer: 0, byteOffset: offset, byteLength: slice.length });
        offset += slice.length;
    }
    const newBin = Buffer.concat(chunks);

    const accOrder = [...accIds].sort((a, b) => a - b);
    const accMap = new Map();
    accOrder.forEach((id, i) => accMap.set(id, i));
    const newAccessors = accOrder.map((id) => {
        const acc = { ...gltf.accessors[id] };
        if (acc.bufferView != null) {
            const mapped = bvOrder.indexOf(acc.bufferView);
            if (mapped < 0) throw new Error('accessor bufferView not in trimmed set: ' + acc.bufferView);
            acc.bufferView = mapped;
        }
        return acc;
    });

    const meshOrder = [...meshIds].sort((a, b) => a - b);
    const meshMap = new Map(meshOrder.map((id, i) => [id, i]));
    const newMeshes = meshOrder.map((id) => {
        const mesh = JSON.parse(JSON.stringify(gltf.meshes[id]));
        for (const prim of mesh.primitives || []) {
            if (prim.indices != null) prim.indices = accMap.get(prim.indices);
            const attrs = {};
            for (const [k, v] of Object.entries(prim.attributes || {})) attrs[k] = accMap.get(v);
            prim.attributes = attrs;
        }
        return mesh;
    });

    const newNodes = selected.map((i) => {
        const n = { ...nodes[i] };
        if (n.mesh != null) n.mesh = meshMap.get(n.mesh);
        return n;
    });

    const destBinName = path.basename(destGltf).replace(/\.gltf$/i, '.bin');
    const out = {
        ...gltf,
        buffers: [{ byteLength: newBin.length, uri: destBinName }],
        bufferViews: bvOrder.map((id) => bvMap.get(id)),
        accessors: newAccessors,
        meshes: newMeshes,
        nodes: newNodes,
        scenes: [{ name: 'Scene', nodes: newNodes.map((_, i) => i) }],
        scene: 0,
    };
    fs.writeFileSync(destGltf, JSON.stringify(out));
    fs.writeFileSync(path.join(path.dirname(destGltf), destBinName), newBin);
    console.log('trimmed variants ' + selected.map((i) => nodes[i].name || i).join(', ') + ' -> ' + destGltf + ' (' + (newBin.length / 1048576).toFixed(1) + ' MB bin)');
    return destGltf;
}

function findAlphaMap(gltfPath, explicit) {
    if (explicit) return explicit;
    const dir = path.dirname(path.resolve(gltfPath));
    const dirs = [dir, path.join(dir, 'textures')];
    const hits = [];
    for (const d of dirs) {
        if (!fs.existsSync(d)) continue;
        for (const name of fs.readdirSync(d)) {
            if (/alpha/i.test(name) && /\.(png|jpg|jpeg)$/i.test(name)) {
                hits.push(path.join(d, name));
            }
        }
    }
    hits.sort((a, b) => {
        const ap = /alpha/i.test(path.basename(a)) && !/mask/i.test(a) ? 0 : 1;
        const bp = /alpha/i.test(path.basename(b)) && !/mask/i.test(b) ? 0 : 1;
        if (ap !== bp) return ap - bp;
        return fs.statSync(b).size - fs.statSync(a).size;
    });
    return hits[0] || null;
}

async function findAtlasIslands(alphaPath, maxIslands = 8) {
    const img = sharp(alphaPath);
    const meta = await img.metadata();
    const width = meta.width;
    const height = meta.height;
    const data = await img.greyscale().raw().toBuffer();
    const thresh = 40;
    const seen = new Uint8Array(width * height);
    const islands = [];
    const qx = new Int32Array(width * height);
    const qy = new Int32Array(width * height);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const start = y * width + x;
            if (seen[start] || data[start] < thresh) continue;
            let qh = 0;
            let qt = 0;
            qx[qt] = x;
            qy[qt] = y;
            qt++;
            seen[start] = 1;
            let minx = x, maxx = x, miny = y, maxy = y, area = 0, sum = 0;
            while (qh < qt) {
                const px = qx[qh];
                const py = qy[qh];
                qh++;
                const p = py * width + px;
                area++;
                sum += data[p];
                if (px < minx) minx = px;
                if (px > maxx) maxx = px;
                if (py < miny) miny = py;
                if (py > maxy) maxy = py;
                if (px > 0 && !seen[p - 1] && data[p - 1] >= thresh) { seen[p - 1] = 1; qx[qt] = px - 1; qy[qt] = py; qt++; }
                if (px + 1 < width && !seen[p + 1] && data[p + 1] >= thresh) { seen[p + 1] = 1; qx[qt] = px + 1; qy[qt] = py; qt++; }
                if (py > 0 && !seen[p - width] && data[p - width] >= thresh) { seen[p - width] = 1; qx[qt] = px; qy[qt] = py - 1; qt++; }
                if (py + 1 < height && !seen[p + width] && data[p + width] >= thresh) { seen[p + width] = 1; qx[qt] = px; qy[qt] = py + 1; qt++; }
            }
            islands.push({ minx, maxx, miny, maxy, area, mean: sum / area });
        }
    }
    islands.sort((a, b) => b.area - a.area);
    const minArea = Math.max(80, Math.floor(width * height * 0.0002));
    const picked = islands.filter((i) => i.area >= minArea).slice(0, maxIslands);
    const pad = 2;
    const rects = picked.map((i) => {
        const x0 = Math.max(0, i.minx - pad);
        const x1 = Math.min(width - 1, i.maxx + pad);
        const y0 = Math.max(0, i.miny - pad);
        const y1 = Math.min(height - 1, i.maxy + pad);
        // PNG y=0 is top; glTF V=0 is bottom.
        return {
            u0: x0 / width,
            v0: 1 - (y1 + 1) / height,
            u1: (x1 + 1) / width,
            v1: 1 - y0 / height,
            area: i.area,
            mean: i.mean,
        };
    });
    console.log('atlas islands in ' + path.basename(alphaPath) + ': ' + islands.length + ' total, using ' + rects.length + ' largest' +
        (rects.length ? ' (areas ' + rects.map((r) => r.area).join(', ') + ')' : ''));
    if (!rects.length) return [{ u0: 0, v0: 0, u1: 1, v1: 1, area: width * height, mean: 1 }];
    return rects;
}

function triangleAreaNormal(ax, ay, az, bx, by, bz, cx, cy, cz) {
    const ux = bx - ax, uy = by - ay, uz = bz - az;
    const vx = cx - ax, vy = cy - ay, vz = cz - az;
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz);
    return { nx, ny, nz, area: 0.5 * len };
}

function rebuildFoliageArrays(pos, indices, uvRects, target) {
    const tris = Math.floor(indices.length / 3);
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (let i = 0; i < pos.length; i += 3) {
        const x = pos[i], y = pos[i + 1], z = pos[i + 2];
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
        if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
    }
    const spanX = Math.max(0.01, maxX - minX);
    const spanY = Math.max(0.01, maxY - minY);
    const spanZ = Math.max(0.01, maxZ - minZ);
    const volume = spanX * spanY * spanZ;
    // Canopy is a cone, not a full box. Nudge the cell size so occupied cells
    // land near the requested card count.
    let cell = Math.cbrt(volume / (target * 3));
    cell = Math.max(cell, Math.max(spanX, spanY, spanZ) / 80);
    let cells = new Map();
    function fillCells(cellSize) {
        const nx = Math.max(1, Math.ceil(spanX / cellSize));
        const ny = Math.max(1, Math.ceil(spanY / cellSize));
        const nz = Math.max(1, Math.ceil(spanZ / cellSize));
        const map = new Map();
        const cellKey = (x, y, z) => {
            const ix = Math.min(nx - 1, Math.max(0, Math.floor((x - minX) / cellSize)));
            const iy = Math.min(ny - 1, Math.max(0, Math.floor((y - minY) / cellSize)));
            const iz = Math.min(nz - 1, Math.max(0, Math.floor((z - minZ) / cellSize)));
            return ix + ',' + iy + ',' + iz;
        };
        for (let t = 0; t < tris; t++) {
            const ia = indices[t * 3] * 3;
            const ib = indices[t * 3 + 1] * 3;
            const ic = indices[t * 3 + 2] * 3;
            const ax = pos[ia], ay = pos[ia + 1], az = pos[ia + 2];
            const bx = pos[ib], by = pos[ib + 1], bz = pos[ib + 2];
            const cx = pos[ic], cy = pos[ic + 1], cz = pos[ic + 2];
            const { nx: nnx, ny: nny, nz: nnz, area } = triangleAreaNormal(ax, ay, az, bx, by, bz, cx, cy, cz);
            if (area <= 1e-12) continue;
            const mx = (ax + bx + cx) / 3;
            const my = (ay + by + cy) / 3;
            const mz = (az + bz + cz) / 3;
            const key = cellKey(mx, my, mz);
            let c = map.get(key);
            if (!c) {
                c = {
                    count: 0, area: 0,
                    sx: 0, sy: 0, sz: 0,
                    snx: 0, sny: 0, snz: 0,
                    minX: mx, maxX: mx, minY: my, maxY: my, minZ: mz, maxZ: mz,
                };
                map.set(key, c);
            }
            c.count++;
            c.area += area;
            c.sx += mx * area; c.sy += my * area; c.sz += mz * area;
            c.snx += nnx; c.sny += nny; c.snz += nnz;
            const xs = [ax, bx, cx], ys = [ay, by, cy], zs = [az, bz, cz];
            for (let k = 0; k < 3; k++) {
                if (xs[k] < c.minX) c.minX = xs[k]; if (xs[k] > c.maxX) c.maxX = xs[k];
                if (ys[k] < c.minY) c.minY = ys[k]; if (ys[k] > c.maxY) c.maxY = ys[k];
                if (zs[k] < c.minZ) c.minZ = zs[k]; if (zs[k] > c.maxZ) c.maxZ = zs[k];
            }
        }
        return map;
    }
    for (let attempt = 0; attempt < 6; attempt++) {
        cells = fillCells(cell);
        if (cells.size >= target * 0.9 && cells.size <= target * 1.2) break;
        if (cells.size === 0) break;
        cell *= Math.cbrt(cells.size / target);
        cell = Math.max(cell, Math.max(spanX, spanY, spanZ) / 96);
    }

    // If we wildly overshot the target, merge by snapping to a coarser grid.
    if (cells.size > target * 1.4) {
        const merge = Math.ceil(Math.cbrt(cells.size / target));
        const merged = new Map();
        for (const [key, c] of cells) {
            const [ix, iy, iz] = key.split(',').map(Number);
            const mk = Math.floor(ix / merge) + ',' + Math.floor(iy / merge) + ',' + Math.floor(iz / merge);
            let m = merged.get(mk);
            if (!m) { merged.set(mk, c); continue; }
            m.count += c.count;
            m.area += c.area;
            m.sx += c.sx; m.sy += c.sy; m.sz += c.sz;
            m.snx += c.snx; m.sny += c.sny; m.snz += c.snz;
            if (c.minX < m.minX) m.minX = c.minX; if (c.maxX > m.maxX) m.maxX = c.maxX;
            if (c.minY < m.minY) m.minY = c.minY; if (c.maxY > m.maxY) m.maxY = c.maxY;
            if (c.minZ < m.minZ) m.minZ = c.minZ; if (c.maxZ > m.maxZ) m.maxZ = c.maxZ;
        }
        cells.clear();
        for (const [k, v] of merged) cells.set(k, v);
    }

    const inflate = 1.2;
    const minExtent = cell * 0.85;
    const outPos = [];
    const outNrm = [];
    const outUv = [];
    const outIdx = [];
    let clusterIndex = 0;

    function pushVert(x, y, z, nxv, nyv, nzv, u, v) {
        const i = outPos.length / 3;
        outPos.push(x, y, z);
        outNrm.push(nxv, nyv, nzv);
        outUv.push(Math.min(1, Math.max(0, u)), Math.min(1, Math.max(0, v)));
        return i;
    }

    function addCross(cx, cy, cz, hx, hy, hz, radialX, radialZ, uv, hash) {
        // Two vertical quads that share a spine, so later whole-card
        // subsampling keeps or drops the cluster together.
        const tx = -radialZ;
        const tz = radialX;
        const tlen = Math.hypot(tx, tz) || 1;
        const tX = tx / tlen, tZ = tz / tlen;
        const rlen = Math.hypot(radialX, radialZ) || 1;
        const rX = radialX / rlen, rZ = radialZ / rlen;
        const [u0, v0, u1, v1] = (hash & 1) ? [uv.u1, uv.v0, uv.u0, uv.v1] : [uv.u0, uv.v0, uv.u1, uv.v1];
        // Flip V or swap corners on some clusters so the atlas isn't tiled identically.
        const flipV = (hash & 2) !== 0;
        const va0 = flipV ? v1 : v0;
        const va1 = flipV ? v0 : v1;

        const topX = cx, topY = cy + hy, topZ = cz;
        const botX = cx, botY = cy - hy, botZ = cz;
        const iTop = pushVert(topX, topY, topZ, rX, 0, rZ, (u0 + u1) / 2, va1);
        const iBot = pushVert(botX, botY, botZ, rX, 0, rZ, (u0 + u1) / 2, va0);

        const iL = pushVert(cx - tX * hx, cy + hy, cz - tZ * hx, rX, 0, rZ, u0, va1);
        const iL2 = pushVert(cx - tX * hx, cy - hy, cz - tZ * hx, rX, 0, rZ, u0, va0);
        const iR = pushVert(cx + tX * hx, cy + hy, cz + tZ * hx, rX, 0, rZ, u1, va1);
        const iR2 = pushVert(cx + tX * hx, cy - hy, cz + tZ * hx, rX, 0, rZ, u1, va0);
        outIdx.push(iL, iBot, iTop, iL, iL2, iBot, iTop, iBot, iR, iBot, iR2, iR);

        const iF = pushVert(cx - rX * hz, cy + hy, cz - rZ * hz, tX, 0, tZ, u0, va1);
        const iF2 = pushVert(cx - rX * hz, cy - hy, cz - rZ * hz, tX, 0, tZ, u0, va0);
        const iB = pushVert(cx + rX * hz, cy + hy, cz + rZ * hz, tX, 0, tZ, u1, va1);
        const iB2 = pushVert(cx + rX * hz, cy - hy, cz - rZ * hz, tX, 0, tZ, u1, va0);
        outIdx.push(iF, iBot, iTop, iF, iF2, iBot, iTop, iBot, iB, iBot, iB2, iB);
        // Note: the two quads share iTop/iBot, so the 8 triangles are one component.
    }

    const midX = (minX + maxX) / 2;
    const midZ = (minZ + maxZ) / 2;
    for (const c of cells.values()) {
        if (c.area <= 0) continue;
        const cx = c.sx / c.area;
        const cy = c.sy / c.area;
        const cz = c.sz / c.area;
        let hx = Math.max((c.maxX - c.minX) * 0.5 * inflate, minExtent * 0.5);
        let hy = Math.max((c.maxY - c.minY) * 0.5 * inflate, minExtent * 0.5);
        let hz = Math.max((c.maxZ - c.minZ) * 0.5 * inflate, minExtent * 0.5);
        // Vertical cards use hx as half-width (tangent) and hz as half-depth (radial).
        const halfW = Math.max(hx, hz);
        let rx = cx - midX;
        let rz = cz - midZ;
        if (Math.hypot(rx, rz) < 1e-5) { rx = 1; rz = 0; }
        const uv = uvRects[clusterIndex % uvRects.length];
        const hash = (Math.imul(clusterIndex + 1, 2654435761) >>> 0);
        addCross(cx, cy, cz, halfW, hy, halfW, rx, rz, uv, hash);
        clusterIndex++;
    }

    return {
        positions: new Float32Array(outPos),
        normals: new Float32Array(outNrm),
        uvs: new Float32Array(outUv),
        indices: outIdx.length <= 65534 ? new Uint16Array(outIdx) : new Uint32Array(outIdx),
        clusters: clusterIndex,
        cell,
        originalTris: tris,
        newTris: outIdx.length / 3,
        bounds: { min: [minX, minY, minZ], max: [maxX, maxY, maxZ] },
    };
}

function rasterizeTriangles(width, height, project, positions, indices, out) {
    const tris = Math.floor(indices.length / 3);
    for (let t = 0; t < tris; t++) {
        const ia = indices[t * 3] * 3;
        const ib = indices[t * 3 + 1] * 3;
        const ic = indices[t * 3 + 2] * 3;
        const a = project(positions[ia], positions[ia + 1], positions[ia + 2]);
        const b = project(positions[ib], positions[ib + 1], positions[ib + 2]);
        const c = project(positions[ic], positions[ic + 1], positions[ic + 2]);
        let minx = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0])));
        let maxx = Math.min(width - 1, Math.ceil(Math.max(a[0], b[0], c[0])));
        let miny = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1])));
        let maxy = Math.min(height - 1, Math.ceil(Math.max(a[1], b[1], c[1])));
        const area = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
        if (Math.abs(area) < 1e-8) {
            // Degenerate / edge-on: stamp the bounding box so a thin card still counts.
            for (let y = miny; y <= maxy; y++) {
                for (let x = minx; x <= maxx; x++) out[y * width + x] = 1;
            }
            continue;
        }
        for (let y = miny; y <= maxy; y++) {
            for (let x = minx; x <= maxx; x++) {
                const px = x + 0.5, py = y + 0.5;
                const w0 = ((b[0] - px) * (c[1] - py) - (b[1] - py) * (c[0] - px)) / area;
                const w1 = ((c[0] - px) * (a[1] - py) - (c[1] - py) * (a[0] - px)) / area;
                const w2 = 1 - w0 - w1;
                if (w0 >= 0 && w1 >= 0 && w2 >= 0) out[y * width + x] = 1;
            }
        }
    }
}

function makeProjector(bounds, width, height, axis) {
    const [minX, minY, minZ] = bounds.min;
    const [maxX, maxY, maxZ] = bounds.max;
    const pad = 0.04;
    if (axis === 'side') {
        const x0 = minX - (maxX - minX) * pad, x1 = maxX + (maxX - minX) * pad;
        const y0 = minY - (maxY - minY) * pad, y1 = maxY + (maxY - minY) * pad;
        return (x, y) => [((x - x0) / (x1 - x0 || 1)) * (width - 1), (1 - (y - y0) / (y1 - y0 || 1)) * (height - 1)];
    }
    if (axis === 'front') {
        const z0 = minZ - (maxZ - minZ) * pad, z1 = maxZ + (maxZ - minZ) * pad;
        const y0 = minY - (maxY - minY) * pad, y1 = maxY + (maxY - minY) * pad;
        return (x, y, z) => [((z - z0) / (z1 - z0 || 1)) * (width - 1), (1 - (y - y0) / (y1 - y0 || 1)) * (height - 1)];
    }
    const x0 = minX - (maxX - minX) * pad, x1 = maxX + (maxX - minX) * pad;
    const z0 = minZ - (maxZ - minZ) * pad, z1 = maxZ + (maxZ - minZ) * pad;
    return (x, y, z) => [((x - x0) / (x1 - x0 || 1)) * (width - 1), ((z - z0) / (z1 - z0 || 1)) * (height - 1)];
}

function coverageRatio(orig, rebuilt) {
    let o = 0, r = 0, both = 0;
    for (let i = 0; i < orig.length; i++) {
        if (orig[i]) o++;
        if (rebuilt[i]) r++;
        if (orig[i] && rebuilt[i]) both++;
    }
    return { original: o, rebuilt: r, overlap: both, vsOriginal: o ? r / o : 0, recall: o ? both / o : 0 };
}

async function writeSilhouette(file, views) {
    // views: [{ title, orig, rebuilt, w, h }]
    const labelH = 28;
    const gap = 12;
    const panelW = views[0].w;
    const panelH = views[0].h;
    const cols = views.length;
    const rows = 2;
    const width = cols * panelW + (cols + 1) * gap;
    const height = rows * (panelH + labelH) + (rows + 1) * gap + 8;
    const rgba = Buffer.alloc(width * height * 4, 255);
    function blitMask(mask, w, h, dx, dy, rgb, onOrig) {
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                if (!mask[y * w + x]) continue;
                const i = ((dy + y) * width + (dx + x)) * 4;
                rgba[i] = rgb[0]; rgba[i + 1] = rgb[1]; rgba[i + 2] = rgb[2]; rgba[i + 3] = 255;
            }
        }
    }
    function fillRect(x, y, w, h, rgb) {
        for (let yy = 0; yy < h; yy++) {
            for (let xx = 0; xx < w; xx++) {
                const i = ((y + yy) * width + (x + xx)) * 4;
                rgba[i] = rgb[0]; rgba[i + 1] = rgb[1]; rgba[i + 2] = rgb[2]; rgba[i + 3] = 255;
            }
        }
    }
    // background
    fillRect(0, 0, width, height, [248, 246, 240]);
    for (let c = 0; c < cols; c++) {
        const v = views[c];
        const x = gap + c * (panelW + gap);
        const y0 = gap + labelH;
        const y1 = gap + labelH + panelH + gap + labelH;
        fillRect(x, y0, panelW, panelH, [255, 255, 255]);
        fillRect(x, y1, panelW, panelH, [255, 255, 255]);
        blitMask(v.orig, v.w, v.h, x, y0, [40, 90, 40]);
        blitMask(v.rebuilt, v.w, v.h, x, y1, [30, 110, 45]);
    }
    const png = await sharp(rgba, { raw: { width, height, channels: 4 } }).png().toBuffer();
    // Stamp titles with a tiny built-in approach: write a sidecar caption in the filename/log,
    // and composite simple bar labels as dark strips (text added below via SVG).
    const labels = views.map((v) => v.title);
    const svg = `<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <style>text{font-family:DejaVu Sans,Arial,sans-serif;font-size:14px;fill:#222}</style>
      ${labels.map((t, i) => {
        const x = gap + i * (panelW + gap);
        return `<text x="${x}" y="${gap + 16}">${t} — original</text>
                <text x="${x}" y="${gap + labelH + panelH + gap + 16}">${t} — rebuilt cards</text>`;
      }).join('\n')}
    </svg>`;
    await sharp(png)
        .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
        .png()
        .toFile(file);
}

async function main() {
    const variantKeys = variantArg.split(/[,+]/).map((s) => s.trim()).filter(Boolean);
    let source = path.resolve(inputPath);
    const tmpFiles = [];
    const gltfLooksMulti = source.toLowerCase().endsWith('.gltf') && fs.existsSync(source);
    if (gltfLooksMulti) {
        const gltf = JSON.parse(fs.readFileSync(source, 'utf8'));
        const nodeNames = (gltf.nodes || []).map((n) => n.name || '');
        const variantNodes = nodeNames.filter((n) => variantKeyFromName(n));
        if (variantNodes.length > 1 && !variantKeys.includes('all')) {
            const dest = path.join(path.dirname(source), path.basename(source, path.extname(source)) + '_' + variantKeys.join('') + '_trim.gltf');
            source = trimGltfToVariants(source, variantKeys, dest);
            tmpFiles.push(dest, dest.replace(/\.gltf$/i, '.bin'));
        } else {
            console.log('using all nodes: ' + nodeNames.join(', '));
        }
    }

    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
    const document = await io.read(source);
    await document.transform(flatten());

    const alphaPath = findAlphaMap(inputPath, alphaOverride);
    if (!alphaPath) console.warn('warning: no twig alpha map found next to the source; UV islands will use the full atlas');
    else console.log('alpha map: ' + alphaPath);
    const uvRects = alphaPath ? await findAtlasIslands(alphaPath) : [{ u0: 0, v0: 0, u1: 1, v1: 1, area: 1, mean: 1 }];

    const foliagePrims = [];
    const solidStats = [];
    for (const mesh of document.getRoot().listMeshes()) {
        for (const prim of mesh.listPrimitives()) {
            if (isFoliagePrimitive(prim)) foliagePrims.push({ mesh, prim });
            else solidStats.push({ name: (prim.getMaterial()?.getName() || mesh.getName() || 'solid'), tris: getGLPrimitiveCount(prim) });
        }
    }
    if (!foliagePrims.length) throw new Error('no foliage primitives found');
    console.log('solid parts: ' + solidStats.map((s) => s.name + ' ' + s.tris + ' tris').join('; '));

    const origCoverage = [];
    let totalOrigTris = 0;
    let totalNewTris = 0;
    let totalClusters = 0;
    let unionBounds = null;

    for (const { prim } of foliagePrims) {
        const position = prim.getAttribute('POSITION');
        const srcIndices = prim.getIndices();
        if (!position || !srcIndices) continue;
        const pos = position.getArray();
        const idx = srcIndices.getArray();
        const posF = pos instanceof Float32Array ? pos : new Float32Array(pos);
        const idxA = idx instanceof Uint32Array || idx instanceof Uint16Array ? idx : new Uint32Array(idx);
        origCoverage.push({ pos: posF, idx: idxA });
        const rebuilt = rebuildFoliageArrays(posF, idxA, uvRects, Math.max(200, Math.round(targetCards / foliagePrims.length)));
        totalOrigTris += rebuilt.originalTris;
        totalNewTris += rebuilt.newTris;
        totalClusters += rebuilt.clusters;
        if (!unionBounds) unionBounds = rebuilt.bounds;
        else {
            for (let i = 0; i < 3; i++) {
                unionBounds.min[i] = Math.min(unionBounds.min[i], rebuilt.bounds.min[i]);
                unionBounds.max[i] = Math.max(unionBounds.max[i], rebuilt.bounds.max[i]);
            }
        }
        const buffer = document.getRoot().listBuffers()[0] || document.createBuffer();
        const posAcc = document.createAccessor().setType('VEC3').setArray(rebuilt.positions).setBuffer(buffer);
        const nrmAcc = document.createAccessor().setType('VEC3').setArray(rebuilt.normals).setBuffer(buffer);
        const uvAcc = document.createAccessor().setType('VEC2').setArray(rebuilt.uvs).setBuffer(buffer);
        const idxAcc = document.createAccessor().setType('SCALAR').setArray(rebuilt.indices).setBuffer(buffer);
        for (const sem of prim.listSemantics()) prim.setAttribute(sem, null);
        prim.setAttribute('POSITION', posAcc);
        prim.setAttribute('NORMAL', nrmAcc);
        prim.setAttribute('TEXCOORD_0', uvAcc);
        prim.setIndices(idxAcc);
        const mat = prim.getMaterial();
        if (mat) {
            mat.setAlphaMode('MASK');
            mat.setAlphaCutoff(0.5);
            mat.setDoubleSided(true);
        }
        console.log('rebuilt ' + (mat?.getName() || 'foliage') + ': ' + rebuilt.originalTris + ' tris -> ' + rebuilt.clusters + ' clusters / ' + rebuilt.newTris + ' tris (cell ' + rebuilt.cell.toFixed(3) + ')');
    }

    await document.transform(prune());
    fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
    await io.write(outPath, document);

    const scene = document.getRoot().getDefaultScene() ?? document.getRoot().listScenes()[0];
    const bounds = scene ? getBounds(scene) : null;
    console.log('wrote ' + outPath + ' (' + (fs.statSync(outPath).size / 1048576).toFixed(2) + ' MB)');
    if (bounds) console.log('bounds min ' + bounds.min.map((n) => n.toFixed(3)).join(', ') + '  max ' + bounds.max.map((n) => n.toFixed(3)).join(', '));
    console.log('foliage triangles: ' + totalOrigTris + ' -> ' + totalNewTris + ' (' + totalClusters + ' clusters, 2 crossed quads each)');

    if (unionBounds && origCoverage.length) {
        const W = 384, H = 512;
        const views = [];
        const reports = {};
        const newPrims = [];
        for (const { prim } of foliagePrims) {
            const p = prim.getAttribute('POSITION')?.getArray();
            const i = prim.getIndices()?.getArray();
            if (p && i) newPrims.push({ pos: p, idx: i });
        }
        for (const axis of ['side', 'front', 'top']) {
            const w = axis === 'top' ? 384 : W;
            const h = axis === 'top' ? 384 : H;
            const orig = new Uint8Array(w * h);
            const rebuilt = new Uint8Array(w * h);
            const project = makeProjector(unionBounds, w, h, axis);
            for (const g of origCoverage) rasterizeTriangles(w, h, project, g.pos, g.idx, orig);
            for (const g of newPrims) rasterizeTriangles(w, h, project, g.pos, g.idx, rebuilt);
            const cov = coverageRatio(orig, rebuilt);
            reports[axis] = cov;
            views.push({ title: axis, orig, rebuilt, w, h });
            console.log('coverage ' + axis + ': rebuilt/original pixels ' + (cov.vsOriginal * 100).toFixed(1) + '% , overlap (recall) ' + (cov.recall * 100).toFixed(1) + '% (orig ' + cov.original + ', new ' + cov.rebuilt + ', both ' + cov.overlap + ')');
        }
        const sil = silhouettePath || path.join(path.dirname(path.resolve(outPath)), path.basename(outPath, path.extname(outPath)) + '-silhouette.png');
        await writeSilhouette(sil, views);
        console.log('silhouette: ' + sil);
        const reportPath = sil.replace(/\.png$/i, '-coverage.json');
        fs.writeFileSync(reportPath, JSON.stringify({ variants: variantKeys, targetCards, totalOrigTris, totalNewTris, totalClusters, reports }, null, 2));
    }

    // Leave trimmed sources in the raw folder so the rebuild can be re-run; they are not assets/.
}

main().catch((err) => {
    console.error(err instanceof Error ? err.stack || err.message : err);
    process.exit(1);
});
