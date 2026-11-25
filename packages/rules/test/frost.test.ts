// Frost is the game's damage type; "cold" must not come back as one (Gabriel, 2026-11-24).
// Descriptions may still say "bitter cold" or "extreme cold": only damage types, resistances and the like are checked.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { WARDING_TYPES } from '../src/runeLimits.ts';

const FILES = ['monsters', 'weapons', 'items', 'spells', 'features', 'species_features', 'calling_features'];
const TYPE_KEYS = new Set(['damage_type', 'extra_type', 'resistance', 'resistances', 'immunities', 'weaknesses', 'resist', 'options']);

// Every value under a damage-type key, anywhere in a content file
function damageTypes(value: unknown, key = '', out: string[] = []): string[] {
    if (Array.isArray(value)) value.forEach((v) => damageTypes(v, key, out));
    else if (value && typeof value === 'object') Object.entries(value).forEach(([k, v]) => damageTypes(v, k, out));
    else if (typeof value === 'string' && TYPE_KEYS.has(key)) out.push(value.toLowerCase());
    return out;
}

test('content uses frost, never cold, as a damage type', () => {
    for (const file of FILES) {
        const data = JSON.parse(readFileSync(new URL(`../../content/source/${file}.json`, import.meta.url), 'utf8'));
        assert.ok(!damageTypes(data).includes('cold'), `${file}.json has "cold" as a damage type`);
    }
});

test('warding runes offer frost, not cold', () => {
    assert.ok(WARDING_TYPES.includes('frost'));
    assert.ok(!WARDING_TYPES.includes('cold'));
});
