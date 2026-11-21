import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const file = path.join(__dirname, '..', '..', '..', '..', 'packages', 'content', 'looks.json');

const looks = JSON.parse(fs.readFileSync(file, 'utf8'));

export default looks;