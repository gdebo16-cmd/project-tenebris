// Adds new monsters to the content pack (packages/content/source/monsters.json).
//
// The new monsters were written in a shorter format (armor_class, hit_points, threat, a nested stats block, a size
// word). This turns each one into the pack's own format, so the game reads it like the monsters already there:
//   armor_class -> armor        hit_points -> max_hp      threat -> threat_level
//   stats.{str..cha} -> str..cha (top level)              speed -> speed.walk
//   size word -> size_id (huge = enormous, gargantuan = titanic: sizes.json)
//   damage and resistances: "cold" -> "frost" (Frost is the game's damage type: Gabriel, 2026-11-24)
//   a "Multiattack" feature -> multiattack: true
// Fields the new format doesn't have get plain defaults: luck and speed stat 10, no save proficiencies, XP 0 (until
// there's a threat-to-XP table), no hit dice, no art (the token shows the first letter).
//
// Run from the repo root:   node scripts/import-monsters.mjs <file> [--shift N] [<file> [--shift N]] ...
//   --shift N  adds N to that file's ids (used for new-monsters-1.json: its 1–20 become 3–22, after Ochre and Ash Hound)
// It refuses to run if an id or a name would clash with a monster already in the pack, so running it twice is safe.
import { readFileSync, writeFileSync } from 'node:fs';

const PACK = 'packages/content/source/monsters.json';
const SIZE_IDS = { tiny: 1, small: 2, medium: 3, large: 4, huge: 5, enormous: 5, gargantuan: 6, titanic: 6 };
const STATS = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
const damageType = (t) => (t === 'cold' ? 'frost' : t);

// Which files, and how far to shift each one's ids
const jobs = [];
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
    if (args[i] === '--shift') jobs[jobs.length - 1].shift = Number(args[++i]);
    else jobs.push({ file: args[i], shift: 0 });
}
if (jobs.length === 0) {
    console.error('Usage: node scripts/import-monsters.mjs <file> [--shift N] ...');
    process.exit(1);
}

// One new monster in the pack's format (same field order as the monsters already there)
function convert(m, shift) {
    const sizeId = SIZE_IDS[m.size];
    if (!sizeId) throw new Error(`${m.name}: unknown size "${m.size}"`);
    for (const s of STATS) if (!Number.isInteger(m.stats?.[s])) throw new Error(`${m.name}: missing stat ${s}`);
    const features = m.features ?? [];
    return {
        id: m.id + shift,
        name: m.name,
        description: m.description ?? '',
        art_url: null,
        size_id: sizeId,
        species_id: null,
        type: m.type ?? null,
        threat_level: m.threat,
        xp: 0,
        ...Object.fromEntries(STATS.map((s) => [s, m.stats[s]])),
        spd: 10,
        luc: 10,
        save_proficiencies: [],
        skill_bonuses: {},
        max_hp: m.hit_points,
        hit_dice: null,
        armor: m.armor_class,
        speed: { walk: m.speed, climb: 0, fly: 0, swim: 0 },
        senses: {},
        languages: [],
        affinity_element_ids: m.affinity_element_ids ?? [],
        resistances: (m.resistances ?? []).map(damageType),
        immunities: (m.immunities ?? []).map(damageType),
        weaknesses: (m.weaknesses ?? []).map(damageType),
        condition_immunities: [],
        attacks: m.attacks.map((a) => ({ ...a, damage_type: damageType(a.damage_type), extra_type: a.extra_type ? damageType(a.extra_type) : null })),
        multiattack: features.some((f) => f.name === 'Multiattack') ? true : null,
        spell_ids: m.spell_ids ?? [],
        spell_stat: m.spell_stat ?? null,
        features,
        reactions: m.reactions ?? [],
        legendary_actions: m.legendary_actions ?? [],
        notes: m.notes ?? '',
    };
}

const pack = JSON.parse(readFileSync(PACK, 'utf8'));
const ids = new Set(pack.map((m) => m.id));
const names = new Set(pack.map((m) => m.name.toLowerCase()));
const added = [];
for (const { file, shift } of jobs) {
    for (const m of JSON.parse(readFileSync(file, 'utf8'))) {
        const row = convert(m, shift);
        if (ids.has(row.id)) throw new Error(`id ${row.id} (${row.name}) is already in the pack: nothing was written`);
        if (names.has(row.name.toLowerCase())) throw new Error(`"${row.name}" is already in the pack: nothing was written`);
        ids.add(row.id);
        names.add(row.name.toLowerCase());
        added.push(row);
    }
}
const all = [...pack, ...added].sort((a, b) => a.id - b.id);
writeFileSync(PACK, JSON.stringify(all, null, 2) + '\n');
console.log(`Added ${added.length} monsters (${all.length} in the pack now).`);
