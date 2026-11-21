// Makes small WebP copies of the big race (and later rune) pictures.
// The form shows these at about 88px. 176px is twice that, so a phone screen stays sharp
// without downloading the 1 MB originals.
import { readdir, mkdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const WIDTH = 176;
const folders = process.argv.slice(2);
const roots = folders.length > 0 ? folders : ['assets/races'];

for (const root of roots) {
    const dir = path.resolve(root);
    const thumbs = path.join(dir, 'thumbs');
    await mkdir(thumbs, { recursive: true });
    const files = (await readdir(dir)).filter((name) => name.toLowerCase().endsWith('.png'));
    for (const name of files) {
        const out = path.join(thumbs, name.replace(/\.png$/i, '.webp'));
        await sharp(path.join(dir, name)).resize({ width: WIDTH }).webp({ quality: 70 }).toFile(out);
        console.log(out);
    }
    console.log(`${files.length} thumbnails in ${thumbs}`);
}
