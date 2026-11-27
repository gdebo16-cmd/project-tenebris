// Bake official Poly Haven foliage alpha maps into a model's base-color textures.
// Poly Haven's 2K glTF packs use JPEG diffuse maps (no alpha) and often leave the
// matching leaves_alpha / twig_alpha / Alpha PNGs out of the file, so leaf cards
// render as solid dark rectangles — bare, stick-like trees. This finds those
// maps next to the source and writes them into the colour texture, then sets
// alphaMode MASK so cutouts work in the instanced board renderer on every
// graphics level, including iOS.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const RES_RE = /_([1248]k)$/i;

export function alphaDirsFor(inputPath, extra = []) {
    const dir = path.dirname(path.resolve(inputPath));
    const folder = path.basename(dir);
    const dirs = [dir, path.join(dir, 'textures')];
    const rawRoot = process.env.TENEBRIS_RAW_LIBRARY;
    if (rawRoot) {
        dirs.push(path.join(rawRoot, 'models', folder), path.join(rawRoot, 'models', folder, 'textures'));
    }
    for (const e of extra) dirs.push(e);
    return [...new Set(dirs)];
}

function parseAlphaFile(file, folderHint = '') {
    let base = path.basename(file).toLowerCase().replace(/\.[a-z0-9]+$/, '');
    base = base.replace(RES_RE, '');
    const hint = String(folderHint || '').toLowerCase();
    if (hint && base.startsWith(hint + '_')) base = base.slice(hint.length + 1);
    const isAlpha = base === 'alpha' || base.endsWith('_alpha');
    const isMask = base === 'mask' || base.endsWith('_mask');
    if (!isAlpha && !isMask) return null;
    const token = base.replace(/_?(alpha|mask)$/i, '');
    return { file, kind: isAlpha ? 'alpha' : 'mask', token };
}

export function findAlphaMaps(dirs) {
    const found = [];
    const seen = new Set();
    for (const dir of dirs) {
        if (!dir || !fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) continue;
        const hint = path.basename(dir) === 'textures' ? path.basename(path.dirname(dir)) : path.basename(dir);
        for (const name of fs.readdirSync(dir)) {
            const file = path.join(dir, name);
            if (!fs.statSync(file).isFile()) continue;
            const parsed = parseAlphaFile(file, hint);
            if (!parsed) continue;
            const key = parsed.kind + ':' + parsed.token;
            if (seen.has(key)) continue;
            seen.add(key);
            found.push(parsed);
        }
    }
    found.sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === 'alpha' ? -1 : 1;
        return b.token.length - a.token.length;
    });
    return found;
}

function escapeRe(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function materialHaystack(material) {
    const name = material.getName() || '';
    const tex = material.getBaseColorTexture();
    const texName = tex ? (tex.getURI() || tex.getName() || '') : '';
    return (name + ' ' + texName).toLowerCase();
}

function mapFits(material, token) {
    const hay = materialHaystack(material);
    if (!token) {
        // A global Alpha map is for materials that already declared a cutout.
        // Don't punch holes in an opaque stem/bush mesh just because its name matches /bush|plant/.
        const mode = material.getAlphaMode();
        return mode === 'MASK' || mode === 'BLEND';
    }
    const re = new RegExp('(^|_|\\b)' + escapeRe(token) + 's?(?=$|_|\\b)', 'i');
    return re.test(hay);
}

async function bakeAlpha(texture, alphaPath) {
    const src = texture.getImage();
    if (!src || !src.byteLength) throw new Error('base color texture is empty');
    const color = sharp(Buffer.from(src));
    const meta = await color.metadata();
    const width = meta.width, height = meta.height;
    if (!width || !height) throw new Error('base color texture has no size');
    const rgba = await color.ensureAlpha().resize(width, height).raw().toBuffer();
    const alpha = await sharp(alphaPath).resize(width, height, { fit: 'fill' }).greyscale().raw().toBuffer();
    if (alpha.length !== width * height) throw new Error('alpha map resize mismatch for ' + alphaPath);
    const out = Buffer.from(rgba);
    for (let i = 0; i < alpha.length; i++) out[i * 4 + 3] = alpha[i];
    const png = await sharp(out, { raw: { width, height, channels: 4 } }).png().toBuffer();
    texture.setImage(png);
    texture.setMimeType('image/png');
    texture.setURI(''); // keep the image embedded in the .glb
}

export async function applyFoliageAlpha(document, dirs) {
    const maps = findAlphaMaps(dirs);
    if (!maps.length) return [];
    const applied = [];
    const baked = new Map();
    for (const material of document.getRoot().listMaterials()) {
        const texture = material.getBaseColorTexture();
        if (!texture) continue;
        const map = maps.find((m) => mapFits(material, m.token));
        if (!map) continue;
        if (!baked.has(texture)) {
            await bakeAlpha(texture, map.file);
            baked.set(texture, map);
        }
        material.setAlphaMode('MASK');
        material.setAlphaCutoff(0.5);
        material.setDoubleSided(true);
        applied.push({ material: material.getName() || '(unnamed)', map: path.basename(map.file), token: map.token || 'alpha' });
    }
    return applied;
}
export async function embedCutoutPng(document) {
    const done = new Set();
    for (const material of document.getRoot().listMaterials()) {
        if (material.getAlphaMode() !== 'MASK') continue;
        const tex = material.getBaseColorTexture();
        if (!tex || done.has(tex)) continue;
        const img = tex.getImage();
        if (!img) continue;
        if ((tex.getMimeType() || '') === 'image/png') {
            tex.setURI('');
            done.add(tex);
            continue;
        }
        const png = await sharp(Buffer.from(img)).png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer();
        tex.setImage(png);
        tex.setMimeType('image/png');
        tex.setURI('');
        done.add(tex);
    }
    return done.size;
}
