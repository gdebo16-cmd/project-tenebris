// Builds content.json and spells.json from source/.
// source/ has one file per section, and each file is exactly what the server reads.
// Edit source/<section>.json, then run: npm run content:build
// The order of each list is the order of the keys in the built file.
import fs from 'node:fs';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const sourceDir = path.join(here, 'source');

const CONTENT_SECTIONS = [
  'scaling_rules', 'roles', 'alignments', 'alignment_bands', 'armor', 'calling_features',
  'class_feature_options', 'features', 'items', 'legacy_classes', 'legacy_races',
  'legacy_subraces', 'legacy_sub_classes', 'monsters', 'personality_options',
  'primordial_blessings', 'proficiency_levels', 'role_features', 'role_item_proficiencies',
  'runes', 'sizes', 'species', 'species_affinity_elements', 'species_features', 'weapons',
  'weapon_category', 'board_models', 'board_paints',
];

const SPELL_SECTIONS = [
  'role_bonus_spells', 'role_spell_slots', 'spells', 'spell_alignment', 'spell_bands',
  'spell_element', 'spell_state', 'spell_upcasts',
];

function readSection(name: string): unknown {
  const file = path.join(sourceDir, `${name}.json`);
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    throw new Error(`source/${name}.json: ${(err as Error).message}`);
  }
}

function build(outFile: string, sections: string[]): void {
  const pack: Record<string, unknown> = {};
  for (const name of sections) {
    const data = readSection(name);
    if (!Array.isArray(data)) throw new Error(`source/${name}.json must be a list`);
    pack[name] = data;
    console.log(`  ${name}: ${data.length}`);
  }
  fs.writeFileSync(path.join(here, outFile), JSON.stringify(pack, null, 2));
}

// Catch files in source/ that neither list mentions, so nothing is silently left out.
const known = new Set([...CONTENT_SECTIONS, ...SPELL_SECTIONS]);
const unknown = fs.readdirSync(sourceDir)
  .filter((f) => f.endsWith('.json') && !known.has(f.slice(0, -5)));
if (unknown.length) throw new Error(`Not in build.ts: ${unknown.join(', ')}`);

console.log('content.json');
build('content.json', CONTENT_SECTIONS);
console.log('spells.json');
build('spells.json', SPELL_SECTIONS);
