// npm run models:check
// Library GLBs (high + light) and paint folders exist, stay under the size cap, and assets/ stays under ~1 GB.
import fs from 'node:fs';
import path from 'node:path';
import { BOARD_MODELS } from '../packages/rules/src/board/models.ts';
import { LIBRARY_PAINTS } from '../packages/rules/src/board/paintLibrary.ts';

const root = path.resolve(import.meta.dirname, '..');
const assets = path.join(root, 'assets');
const CAP_HIGH = 15 * 1024 * 1024;
const ASSETS_BUDGET = 1024 * 1024 * 1024;
let failed = false;
const fail = (msg) => { failed = true; console.log('FAIL ' + msg); };

function assetPath(url) {
  return path.join(assets, url.replace(/^\//, '').replace(/^models\//, 'models/').replace(/^textures\//, 'textures/'));
}

function sizeOf(dir) {
  if (!fs.existsSync(dir)) return 0;
  let total = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    total += entry.isDirectory() ? sizeOf(p) : fs.statSync(p).size;
  }
  return total;
}

let modelBytes = 0;
for (const model of BOARD_MODELS) {
  const high = assetPath(model.file);
  const light = assetPath(model.lightFile ?? model.file.replace(/\.glb$/, '.light.glb'));
  for (const [label, file] of [['high', high], ['light', light]]) {
    if (!fs.existsSync(file)) fail(`${model.id}: missing ${label} ${path.relative(assets, file)}`);
    else {
      const n = fs.statSync(file).size;
      modelBytes += n;
      if (label === 'high' && n > CAP_HIGH) fail(`${model.id}: high GLB is ${(n / 1048576).toFixed(2)} MB, over 15 MB`);
      else console.log(`ok   ${model.id} ${label}: ${(n / 1048576).toFixed(2)} MB`);
    }
  }
  const source = path.join(path.dirname(high), 'SOURCE.txt');
  if (!fs.existsSync(source)) fail(`${model.id}: missing SOURCE.txt`);
}

let paintBytes = 0;
const maps = ['color', 'normal', 'rough'];
for (const paint of LIBRARY_PAINTS) {
  const dir = path.join(assets, 'textures', paint.folder);
  const missing = [];
  for (const map of maps) {
    if (!fs.existsSync(path.join(dir, `${map}.jpg`))) missing.push(`${map}.jpg`);
    if (!fs.existsSync(path.join(dir, `${map}-1k.jpg`))) missing.push(`${map}-1k.jpg`);
  }
  if (!fs.existsSync(path.join(dir, 'thumb.jpg'))) missing.push('thumb.jpg');
  if (!fs.existsSync(path.join(dir, 'SOURCE.txt'))) missing.push('SOURCE.txt');
  if (missing.length) fail(`${paint.id}: missing ${missing.join(', ')}`);
  else {
    const n = sizeOf(dir);
    paintBytes += n;
    console.log(`ok   ${paint.id}: ${(n / 1048576).toFixed(2)} MB`);
  }
}

const assetsBytes = sizeOf(assets);
console.log(`${BOARD_MODELS.length} models (${(modelBytes / 1048576).toFixed(1)} MB), ${LIBRARY_PAINTS.length} paints (${(paintBytes / 1048576).toFixed(1)} MB)`);
console.log(`assets/ total ${(assetsBytes / 1048576).toFixed(1)} MB`);
if (assetsBytes > ASSETS_BUDGET) fail(`assets/ is ${(assetsBytes / 1048576).toFixed(1)} MB, over 1 GB`);
console.log(failed ? 'models:check FAILED' : 'models:check passed');
process.exit(failed ? 1 : 0);