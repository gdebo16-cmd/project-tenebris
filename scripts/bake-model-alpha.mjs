// Bake official Poly Haven foliage alpha maps into already-processed high/light GLBs.
// Does not rescale or re-simplify (keeps current size and triangle counts).
// Writes a real .glb temp file so buffers and textures stay embedded (a non-.glb
// suffix would make glTF-Transform spill sidecars and leave a tiny JSON "GLB").
import fs from 'node:fs';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { meshopt, textureCompress } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';
import { applyFoliageAlpha, alphaDirsFor } from './model-alpha.mjs';

const root = path.resolve(import.meta.dirname, '..');
const rawRoot = process.env.TENEBRIS_RAW_LIBRARY || 'C:/Users/gdebo/agent-tools/tenebris-fixes/raw-library';
const HIGH = { quality: 85, maxTexture: 2048, maxBytes: 15 * 1024 * 1024, label: 'high' };
const LIGHT = { quality: 55, maxTexture: 1024, maxBytes: 2 * 1024 * 1024, label: 'light' };

const MODELS = [
  'tree_small_02', 'fir_tree_01', 'pine_tree_01', 'island_tree_01', 'jacaranda_tree',
  'fir_sapling', 'searsia_lucida', 'fern_02', 'wild_rooibos_bush', 'shrub_02', 'shrub_03',
  'nettle_plant', 'celandine_01', 'dandelion_01', 'shrub_01', 'grass_medium_01', 'moss_01',
];
const only = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const ids = only.length ? only : MODELS;

await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });

async function hasTextureAlpha(texture) {
  const img = texture?.getImage();
  if (!img) return false;
  const meta = await sharp(Buffer.from(img)).metadata();
  return !!meta.hasAlpha && (meta.channels || 0) >= 4;
}

function assertEmbeddedGlb(file, minBytes) {
  const buf = fs.readFileSync(file);
  if (buf.slice(0, 4).toString() !== 'glTF') {
    throw new Error(file + ' is not an embedded GLB (magic=' + buf.slice(0, 4).toString() + ')');
  }
  if (buf.length < minBytes) {
    throw new Error(file + ' is suspiciously small (' + buf.length + ' bytes, expected at least ' + minBytes + ')');
  }
  const jsonLen = buf.readUInt32LE(12);
  const json = buf.slice(20, 20 + jsonLen).toString('utf8');
  if (/"uri"\s*:/.test(json)) {
    throw new Error(file + ' still has external URIs');
  }
}

async function bakeFile(file, preset, dirs) {
  const beforeBytes = fs.statSync(file).size;
  const document = await io.read(file);
  const applied = await applyFoliageAlpha(document, dirs);
  if (!applied.length) {
    console.log(preset.label, path.basename(file) + ': no matching foliage materials');
    return { applied, skipped: true };
  }
  let quality = preset.quality;
  for (let attempt = 0; attempt < 3; attempt++) {
    await document.transform(
      textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [preset.maxTexture, preset.maxTexture], quality }),
      meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
    );
    const tmp = file.replace(/\.glb$/i, '.alpha-tmp.glb');
    await io.write(tmp, document);
    const bytes = fs.statSync(tmp).size;
    if (bytes <= preset.maxBytes || attempt === 2) {
      assertEmbeddedGlb(tmp, Math.min(100 * 1024, Math.floor(beforeBytes * 0.2)));
      fs.renameSync(tmp, file);
      const missing = [];
      for (const mat of document.getRoot().listMaterials()) {
        if (mat.getAlphaMode() !== 'MASK') continue;
        const ok = await hasTextureAlpha(mat.getBaseColorTexture());
        if (!ok) missing.push(mat.getName() || '(unnamed)');
      }
      if (missing.length) throw new Error(path.basename(file) + ' MASK materials lost alpha: ' + missing.join(', '));
      const over = bytes > preset.maxBytes ? ' OVER CAP' : '';
      console.log(preset.label, path.basename(file), (beforeBytes / 1048576).toFixed(2) + ' -> ' + (bytes / 1048576).toFixed(2) + ' MB', 'q' + quality + over, applied.map((a) => a.material + '<-' + a.map).join(', '));
      return { applied, bytes, quality };
    }
    fs.unlinkSync(tmp);
    quality = Math.max(30, quality - 15);
    console.log(preset.label, path.basename(file), 'over cap at q' + (quality + 15) + ', retry q' + quality);
  }
}

for (const id of ids) {
  const dirs = alphaDirsFor(path.join(rawRoot, 'models', id, id + '_2k.gltf'), [
    path.join(rawRoot, 'models', id, 'textures'),
    path.join(rawRoot, 'models', id),
  ]);
  const high = path.join(root, 'assets/models', id, id + '.glb');
  const light = path.join(root, 'assets/models', id, id + '.light.glb');
  if (!fs.existsSync(high) || !fs.existsSync(light)) {
    console.error('missing GLB for', id);
    continue;
  }
  await bakeFile(high, HIGH, dirs);
  await bakeFile(light, LIGHT, dirs);
  const leaked = fs.readdirSync(path.dirname(high)).filter((n) => /\.(webp|bin)$/i.test(n) || n.endsWith('.alpha-tmp.glb'));
  if (leaked.length) throw new Error('sidecar leak in ' + id + ': ' + leaked.join(', '));
}
console.log('bake complete');