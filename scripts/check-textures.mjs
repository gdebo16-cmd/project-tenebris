// npm run textures:check  (T2) Every surface and terrain rule has its ground set, and the whole set loads in under 2 s.
// Serves assets/ on a local port, opens Chromium (Playwright) and times fetching, decoding and uploading every picture
// to the graphics card (with mipmaps), all at once, the way the board loads them.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { GROUND_SETS, groundFiles, TEXTURE_MAPS, textureUrl } from '../apps/web/src/components/table/board/ground/groundTextures.ts';
import { waterLookFor, iceLook } from '../apps/web/src/components/table/board/ground/boardLooks.ts';

const LIMIT_MS = 2000;
const assets = path.resolve(import.meta.dirname, '..', 'assets');
let failed = false;
const fail = (msg) => { failed = true; console.log('FAIL ' + msg); };

for (const { name, set } of GROUND_SETS) {
    if (set.type === 'shader') {
        const ok = set.shader === 'water' ? typeof waterLookFor(0, true) === 'function' : typeof iceLook === 'function';
        console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: custom ${set.shader} shader`);
        if (!ok) failed = true;
        continue;
    }
    const missing = TEXTURE_MAPS.filter((m) => !fs.existsSync(path.join(assets, textureUrl(set.folder, m))));
    if (missing.length) fail(`${name}: ${set.folder} is missing ${missing.join(', ')}`);
    else console.log(`ok   ${name}: ${set.folder}`);
}

const server = http.createServer((req, res) => {
    const name = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (name === '/') { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end('<!doctype html><title>textures</title>'); return; }
    const file = path.join(assets, name);
    if (!file.startsWith(assets) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': 'image/jpeg' });
    fs.createReadStream(file).pipe(res);
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
try {
    const page = await browser.newPage();
    await page.goto(`${base}/`);
    const files = groundFiles();
    const result = await page.evaluate(async (urls) => {
        const gl = document.createElement('canvas').getContext('webgl2');
        const start = performance.now();
        await Promise.all(urls.map(async (url) => {
            const res = await fetch(url, { cache: 'no-store' });
            if (!res.ok) throw new Error(`${url}: ${res.status}`);
            const bitmap = await createImageBitmap(await res.blob());
            if (gl) {
                const t = gl.createTexture();
                gl.bindTexture(gl.TEXTURE_2D, t);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bitmap);
                gl.generateMipmap(gl.TEXTURE_2D);
            }
            bitmap.close();
        }));
        if (gl) gl.finish();
        return { ms: performance.now() - start, gpu: !!gl };
    }, files);
    const mb = files.reduce((n, f) => n + fs.statSync(path.join(assets, f)).size, 0) / 1048576;
    console.log(`${files.length} pictures (${mb.toFixed(1)} MB) loaded in ${Math.round(result.ms)} ms${result.gpu ? ' (decoded and uploaded with mipmaps)' : ' (decoded; no WebGL2 here)'}`);
    if (result.ms >= LIMIT_MS) fail(`took ${Math.round(result.ms)} ms, over ${LIMIT_MS} ms`);
} finally {
    await browser.close();
    server.close();
}
console.log(failed ? 'textures:check FAILED' : 'textures:check passed');
process.exit(failed ? 1 : 0);
