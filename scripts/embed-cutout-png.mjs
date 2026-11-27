import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';

const root = path.resolve(import.meta.dirname, '..');
const HIGH_CAP = 15 * 1024 * 1024;
const LIGHT_CAP = 2 * 1024 * 1024;
const MODELS = [
  'tree_small_02', 'fir_tree_01', 'pine_tree_01', 'island_tree_01', 'jacaranda_tree',
  'fir_sapling', 'searsia_lucida', 'fern_02', 'wild_rooibos_bush', 'shrub_02', 'shrub_03',
  'nettle_plant', 'celandine_01', 'dandelion_01', 'shrub_01', 'grass_medium_01', 'moss_01',
];
const startFrom = process.argv[2] || MODELS[0];
const start = Math.max(0, MODELS.indexOf(startFrom));

await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });

function assertEmbeddedGlb(file, minBytes) {
  const buf = fs.readFileSync(file);
  if (buf.slice(0, 4).toString() !== 'glTF') throw new Error(file + ' is not a GLB');
  if (buf.length < minBytes) throw new Error(file + ' too small: ' + buf.length);
  const jsonLen = buf.readUInt32LE(12);
  const json = buf.slice(20, 20 + jsonLen).toString('utf8');
  if (/"uri"\s*:/.test(json)) throw new Error(file + ' has external URIs');
}

async function writePng(tex, opts) {
  const img = tex.getImage();
  if (!img) return false;
  let pipeline = sharp(Buffer.from(img)).ensureAlpha();
  if (opts.maxDim) pipeline = pipeline.resize(opts.maxDim, opts.maxDim, { fit: 'inside' });
  const png = await pipeline.png({ compressionLevel: 9, adaptiveFiltering: true, palette: !!opts.palette }).toBuffer();
  tex.setImage(png);
  tex.setMimeType('image/png');
  tex.setURI('');
  return true;
}

async function applyCutouts(document, opts) {
  const done = new Set();
  for (const material of document.getRoot().listMaterials()) {
    if (material.getAlphaMode() !== 'MASK') continue;
    const tex = material.getBaseColorTexture();
    if (!tex || done.has(tex)) continue;
    await writePng(tex, opts);
    done.add(tex);
  }
  return done.size;
}

async function convert(file, cap) {
  const before = fs.statSync(file).size;
  const attempts = [
    { palette: false },
    { palette: true },
    { palette: true, maxDim: 768 },
    { palette: true, maxDim: 512 },
  ];
  let lastSize = 0;
  for (const opts of attempts) {
    const document = await io.read(file);
    const n = await applyCutouts(document, opts);
    if (!n) { console.log('skip', path.basename(file)); return; }
    await document.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
    const tmp = file.replace(/\.glb$/i, '.png-tmp.glb');
    await io.write(tmp, document);
    lastSize = fs.statSync(tmp).size;
    if (lastSize <= cap) {
      assertEmbeddedGlb(tmp, Math.min(100 * 1024, Math.floor(before * 0.2)));
      fs.renameSync(tmp, file);
      const label = opts.maxDim ? ('png pal ' + opts.maxDim) : (opts.palette ? 'png pal' : 'png');
      console.log(path.basename(file), (before / 1048576).toFixed(2), '->', (lastSize / 1048576).toFixed(2), 'MB', n, label);
      return;
    }
    fs.unlinkSync(tmp);
    console.log(path.basename(file), 'retry, was', (lastSize / 1048576).toFixed(2), 'MB', JSON.stringify(opts));
  }
  throw new Error(path.basename(file) + ' still over cap: ' + (lastSize / 1048576).toFixed(2) + ' MB');
}


async function isPngCutout(file) {
  const doc = await io.read(file);
  for (const mat of doc.getRoot().listMaterials()) {
    if (mat.getAlphaMode() !== 'MASK') continue;
    if ((mat.getBaseColorTexture()?.getMimeType() || '') !== 'image/png') return false;
  }
  return true;
}

for (const id of MODELS.slice(start)) {
  const dir = path.join(root, 'assets/models', id);
  const high = path.join(dir, id + '.glb');
  const light = path.join(dir, id + '.light.glb');
  if (await isPngCutout(high)) console.log(id + '.glb already png');
  else await convert(high, HIGH_CAP);
  if (await isPngCutout(light)) console.log(id + '.light.glb already png');
  else await convert(light, LIGHT_CAP);
  const leaked = fs.readdirSync(dir).filter((n) => /\.(webp|bin)$/i.test(n) || n.includes('png-tmp'));
  if (leaked.length) throw new Error('sidecar leak in ' + id + ': ' + leaked.join(', '));
}
console.log('png cutouts done');
