// npm run library:import
// Download the curated Poly Haven paints (2K + 1K + thumb) and models (high + light via npm run model).
// Default: scripts/library-manifest.json (the capped keep set).
//   --deferred  import the unpicked candidates in scripts/library-deferred.json
//   --all       import the keep set and the deferred candidates
// Stops if assets/ would go past ~950 MB so the repo stays under ~1 GB.
import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { spawnSync } from 'node:child_process';
import sharp from 'sharp';

const root = path.resolve(import.meta.dirname, '..');
const args = new Set(process.argv.slice(2));
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'scripts/library-manifest.json'), 'utf8'));
const deferredPath = path.join(root, 'scripts/library-deferred.json');
const deferred = fs.existsSync(deferredPath) ? JSON.parse(fs.readFileSync(deferredPath, 'utf8')) : { textures: { items: [] }, models: { items: [] } };
function catalog() {
  if (args.has('--deferred')) {
    return { paints: deferred.textures.items, models: deferred.models.items, label: 'deferred' };
  }
  if (args.has('--all')) {
    return {
      paints: [...manifest.textures.items, ...deferred.textures.items],
      models: [...manifest.models.items, ...deferred.models.items],
      label: 'keep + deferred',
    };
  }
  return { paints: manifest.textures.items, models: manifest.models.items, label: 'keep' };
}
const selected = catalog();
console.log('import set:', selected.label, selected.paints.length, 'paints,', selected.models.length, 'models');
const UA = 'Tenebris (Eldrid Tales) https://github.com/gdebo16-cmd/project-tenebris';
const rawRoot = path.join('C:/Users/gdebo/agent-tools/tenebris-fixes/raw-library');
const ASSETS_STOP = 950 * 1024 * 1024;
const CONCURRENCY = 3;

function assetsSize(dir = path.join(root, 'assets')) {
  if (!fs.existsSync(dir)) return 0;
  let total = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    total += entry.isDirectory() ? assetsSize(p) : fs.statSync(p).size;
  }
  return total;
}

function request(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': UA, ...headers } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) {
        const next = res.headers.location;
        res.resume();
        if (!next) return reject(new Error('redirect without location: ' + url));
        return request(new URL(next, url).href, headers).then(resolve, reject);
      }
      resolve(res);
    });
    req.on('error', reject);
  });
}

async function getJson(url) {
  const res = await request(url, { Accept: 'application/json' });
  if (res.statusCode !== 200) {
    const chunks = [];
    for await (const c of res) chunks.push(c);
    throw new Error(url + ' ' + res.statusCode + ' ' + Buffer.concat(chunks).toString('utf8').slice(0, 200));
  }
  const chunks = [];
  for await (const c of res) chunks.push(c);
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function download(url, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const tmp = dest + '.part';
  const res = await request(url);
  if (res.statusCode !== 200) {
    res.resume();
    throw new Error('download ' + url + ' -> ' + res.statusCode);
  }
  await new Promise((resolve, reject) => {
    const out = fs.createWriteStream(tmp);
    res.pipe(out);
    out.on('finish', resolve);
    out.on('error', reject);
    res.on('error', reject);
  });
  fs.renameSync(tmp, dest);
}

function pickFile(entry, res) {
  if (!entry) return null;
  const level = entry[res] || entry['2k'] || entry['1k'] || entry['4k'];
  if (!level) return null;
  return level.jpg || level.png || level.webp || level.exr || null;
}

function pickMap(files, names, res = '2k') {
  for (const name of names) {
    const file = pickFile(files[name], res);
    if (file?.url) return { name, file };
  }
  return null;
}

const COLOR_NAMES = ['Diffuse', 'diff', 'Color', 'col', 'diff_color', 'albedo', 'Albedo'];
const NORMAL_NAMES = ['nor_gl', 'Normal', 'nor', 'normal_gl', 'NormalGL'];
const ROUGH_NAMES = ['Rough', 'rough', 'roughness', 'Roughness'];

function sourceText(kind, item) {
  return `${item.name}\n${item.authors}\nCC0\n${item.url}\nImported for Tenebris with scripts/import-polyhaven.mjs\n`;
}

async function importPaint(item) {
  const dir = path.join(root, 'assets/textures/library', item.id);
  const colorPath = path.join(dir, 'color.jpg');
  if (fs.existsSync(colorPath) && fs.existsSync(path.join(dir, 'color-1k.jpg')) && fs.existsSync(path.join(dir, 'thumb.jpg')) && fs.existsSync(path.join(dir, 'SOURCE.txt'))) {
    console.log('skip paint', item.id);
    return 'skip';
  }
  if (assetsSize() > ASSETS_STOP) return 'budget';
  const files = await getJson('https://api.polyhaven.com/files/' + item.id);
  const color = pickMap(files, COLOR_NAMES);
  const normal = pickMap(files, NORMAL_NAMES);
  const rough = pickMap(files, ROUGH_NAMES);
  if (!color || !normal || !rough) throw new Error(item.id + ' missing maps: ' + [!color && 'color', !normal && 'normal', !rough && 'rough'].filter(Boolean).join(', ') + ' keys=' + Object.keys(files).join(','));
  fs.mkdirSync(dir, { recursive: true });
  const rawDir = path.join(rawRoot, 'textures', item.id);
  fs.mkdirSync(rawDir, { recursive: true });
  const rawColor = path.join(rawDir, 'color' + (path.extname(new URL(color.file.url).pathname) || '.jpg'));
  const rawNormal = path.join(rawDir, 'normal' + (path.extname(new URL(normal.file.url).pathname) || '.jpg'));
  const rawRough = path.join(rawDir, 'rough' + (path.extname(new URL(rough.file.url).pathname) || '.jpg'));
  await download(color.file.url, rawColor);
  await download(normal.file.url, rawNormal);
  await download(rough.file.url, rawRough);
  async function writeMaps(src, name, isColor) {
    const img = sharp(src);
    const twoK = path.join(dir, name + '.jpg');
    const oneK = path.join(dir, name + '-1k.jpg');
    await img.clone().resize(2048, 2048, { fit: 'fill' }).jpeg({ quality: isColor ? 90 : 85, mozjpeg: true }).toFile(twoK);
    await img.clone().resize(1024, 1024, { fit: 'fill' }).jpeg({ quality: isColor ? 85 : 80, mozjpeg: true }).toFile(oneK);
    if (name === 'color') await img.clone().resize(256, 256, { fit: 'fill' }).jpeg({ quality: 80, mozjpeg: true }).toFile(path.join(dir, 'thumb.jpg'));
  }
  await writeMaps(rawColor, 'color', true);
  await writeMaps(rawNormal, 'normal', false);
  await writeMaps(rawRough, 'rough', false);
  fs.writeFileSync(path.join(dir, 'SOURCE.txt'), sourceText('paint', item));
  console.log('paint', item.id, (sizeOfDir(dir) / 1048576).toFixed(2) + ' MB');
  return 'ok';
}

function sizeOfDir(dir) {
  return assetsSize(dir);
}

function pickModelGltf(files) {
  const gltf = files.gltf || files.glTF || files['gltf'];
  if (!gltf) return null;
  const level = gltf['2k'] || gltf['1k'] || gltf['4k'] || gltf['8k'];
  if (!level) return null;
  return level.gltf || level.glb || null;
}

async function importModel(item) {
  const id = item.id;
  if (item.already === 'boulder' || id === 'boulder') {
    const dest = path.join(root, 'assets/models/boulder');
    if (fs.existsSync(path.join(dest, 'boulder.glb')) && fs.existsSync(path.join(dest, 'boulder.light.glb'))) {
      console.log('skip model boulder (already processed)');
      return 'skip';
    }
  }
  const destDir = path.join(root, 'assets/models', id);
  if (fs.existsSync(path.join(destDir, id + '.glb')) && fs.existsSync(path.join(destDir, id + '.light.glb'))) {
    console.log('skip model', id);
    return 'skip';
  }
  if (assetsSize() > ASSETS_STOP) return 'budget';
  const files = await getJson('https://api.polyhaven.com/files/' + item.sourceId);
  const gltf = pickModelGltf(files);
  if (!gltf?.url) throw new Error(item.sourceId + ' has no glTF 2K. keys=' + Object.keys(files).join(','));
  const rawDir = path.join(rawRoot, 'models', item.sourceId);
  fs.mkdirSync(rawDir, { recursive: true });
  const mainName = path.basename(new URL(gltf.url).pathname) || (item.sourceId + '.gltf');
  const mainPath = path.join(rawDir, mainName);
  if (!fs.existsSync(mainPath)) await download(gltf.url, mainPath);
  const includes = gltf.include || {};
  for (const [name, info] of Object.entries(includes)) {
    const dest = path.join(rawDir, name);
    if (fs.existsSync(dest)) continue;
    const url = info.url || info;
    if (typeof url !== 'string') continue;
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    await download(url, dest);
  }
  fs.mkdirSync(destDir, { recursive: true });
  const outHigh = path.join(destDir, id + '.glb');
  const worldWidth = Math.max(1, Number(item.width) || 1) * 2; // manifest width is in hexes; model.mjs --width is world units (2 = one hex)
  const args = [path.join(root, 'scripts/model.mjs'), mainPath, '--out', outHigh, '--width', String(worldWidth)];
  const result = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) {
    console.error(result.stdout);
    console.error(result.stderr);
    throw new Error('model script failed for ' + id);
  }
  process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  fs.writeFileSync(path.join(destDir, 'SOURCE.txt'), sourceText('model', item) + 'Cleaned with npm run model (high + light).\n');
  const highN = fs.existsSync(outHigh) ? fs.statSync(outHigh).size : 0;
  const lightN = fs.existsSync(path.join(destDir, id + '.light.glb')) ? fs.statSync(path.join(destDir, id + '.light.glb')).size : 0;
  console.log('model', id, 'high', (highN / 1048576).toFixed(2) + ' MB', 'light', (lightN / 1048576).toFixed(2) + ' MB');
  return 'ok';
}

async function pool(items, fn) {
  const results = [];
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const item = items[i++];
      results.push(await fn(item));
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, () => worker()));
  return results;
}

const started = Date.now();
console.log('assets before', (assetsSize() / 1048576).toFixed(1), 'MB');
const paints = [...selected.paints];
const paintResults = [];
for (const item of paints) {
  try {
    const r = await importPaint(item);
    paintResults.push(r);
    if (r === 'budget') {
      console.log('stopping paints: assets budget reached');
      break;
    }
  } catch (err) {
    console.error('PAINT FAIL', item.id, err);
    paintResults.push('fail');
  }
}
const models = [...selected.models];
const modelResults = [];
for (const item of models) {
  try {
    const r = await importModel(item);
    modelResults.push(r);
    if (r === 'budget') {
      console.log('stopping models: assets budget reached');
      break;
    }
  } catch (err) {
    console.error('MODEL FAIL', item.sourceId, err);
    modelResults.push('fail');
  }
}

function tally(list) {
  return list.reduce((t, v) => (t[v] = (t[v] || 0) + 1, t), {});
}
console.log('paints', tally(paintResults));
console.log('models', tally(modelResults));
console.log('assets after', (assetsSize() / 1048576).toFixed(1), 'MB in', Math.round((Date.now() - started) / 1000) + 's');
if (paintResults.includes('fail') || modelResults.includes('fail')) process.exit(1);