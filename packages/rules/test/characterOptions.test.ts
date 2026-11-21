import { test } from 'node:test';
import assert from 'node:assert/strict';
import { characterOptions, choiceFeaturesFor, checkChoicePicks, giftsAllowed, sizeOptions, CALLING_LEVEL, type OptionsPack } from '../src/characterOptions.ts';

// A tiny fake pack: 2 species (one with a sub-species), 1 role with 2 callings, 3 gifts.
// Small on purpose, so every expected answer is easy to check by eye.
const pack: OptionsPack = {
    species: [
        { id: 1, key: 'igni', name: 'Igni', parent_id: null, size_id: 3, image: '/races/igni.png', sort_order: 2 },
        { id: 2, key: 'elf', name: 'Elf', parent_id: null, size_id: 3, image: '/races/elf.png', sort_order: 1 },
        { id: 3, key: 'dawn_elf', name: 'Dawn Elf', parent_id: 2, size_id: 3, image: '/races/dawn.png' },
    ],
    sizes: [
        { id: 1, key: 'tiny', name: 'Tiny' },
        { id: 2, key: 'small', name: 'Small' },
        { id: 3, key: 'medium', name: 'Medium' },
        { id: 4, key: 'large', name: 'Large' },
        { id: 5, key: 'enormous', name: 'Enormous' },
    ],
    roles: [{
        id: 10, key: 'warrior', name: 'Warrior', hit_die: 'd12', primary_stat: 'Might', img_url: '/classes/warrior.png',
        skill_count: 2, skill_options: ['Balance', 'Presence', 'Awareness'], skill_fixed: ['Athletics'],
        levels: [
            { level: 1, features: [
                { name: 'Preferred Arms', options: ['Minor', 'Great', 'Reach'], choice_count: 2, data: { choice_timing: 'create' } },
                { name: 'Not a picker', options: ['Nope'], data: { choice_timing: 'level' } },
            ] },
            { level: 5, features: [{ name: 'Later', options: ['A', 'B'], choice_count: 1, data: { choice_timing: 'create' } }] },
        ],
        callings: [
            { id: 100, key: 'reaper', name: 'Path of the Reaper', features: [
                { name: 'Reap', level: 3, options: ['Hook', 'Scythe'], choice_count: 1, data: { choice_timing: 'create' } },
            ] },
            { id: 101, key: 'hero', name: 'Path of the Hero' },
        ],
    }],
    primordial_blessings: [{ id: 1, name: 'Steady Bulwark' }, { id: 2, name: 'Swift Step' }, { id: 3, name: 'Iron Resolve' }],
    alignments: [
        { code: 'CE', name: 'Chaotic Evil', law_axis: 1, good_axis: -1, sort: 9 },
        { code: 'LG', name: 'Lawful Good', law_axis: -1, good_axis: 1, sort: 1 },
    ],
    personality_options: [
        { id: 1, category: 'upbringing', name: 'Orphan' },
        { id: 2, category: 'lifestyle', name: 'Wanderer' },
        { id: 3, category: 'outlook', name: 'Hopeful' },
    ],
    looks: {
        eye_colors: ['Brown', 'Green'],
        // igni asks for Enormous on purpose: the cap must remove it
        species: { igni: { size_ids: [3, 5], variants: ['Ember', 'Ash'] }, elf: { size_ids: [2, 3] } },
    },
};

test('callings only appear from level 3, for the picked role', () => {
    assert.equal(CALLING_LEVEL, 3);
    assert.deepEqual(characterOptions(pack, { level: 2, role_id: 10 }).callings, []);
    const atThree = characterOptions(pack, { level: 3, role_id: 10 }).callings;
    assert.deepEqual(atThree.map((c) => c.name), ['Path of the Reaper', 'Path of the Hero']);
});

test('no role picked means no callings and no skills yet', () => {
    const options = characterOptions(pack, { level: 5 });
    assert.deepEqual(options.callings, []);
    assert.equal(options.skills, null);
});

test('skills come from the picked role', () => {
    assert.deepEqual(characterOptions(pack, { level: 1, role_id: 10 }).skills,
        { choose: 2, from: ['Balance', 'Presence', 'Awareness'], fixed: ['Athletics'] });
});

test('no species offers a size above Large', () => {
    const igni = pack.species[0];
    assert.deepEqual(sizeOptions(igni, pack.looks, pack.sizes).map((s) => s.name), ['Medium']);   // Enormous removed
    for (const s of characterOptions(pack, { level: 1 }).species) {
        for (const size of s.sizes) assert.ok(size.id <= 4, `${s.name} offers ${size.name}`);
    }
});

test('a species missing from looks.json keeps its own size', () => {
    const noLooks = { ...pack.looks, species: {} };
    assert.deepEqual(sizeOptions(pack.species[0], noLooks, pack.sizes).map((s) => s.name), ['Medium']);
});

test('gifts allowed by level (placeholder rule until DECISIONS.md says otherwise)', () => {
    assert.equal(giftsAllowed(1), 1);
    assert.equal(giftsAllowed(3), 1);
    assert.equal(giftsAllowed(4), 2);
    assert.equal(giftsAllowed(8), 3);
    assert.equal(giftsAllowed(20), 3);
    assert.equal(characterOptions(pack, { level: 4 }).gifts.choose, 2);
    assert.equal(characterOptions(pack, { level: 4 }).gifts.from.length, 3);
});

test('a species with sub-species lists them; one without lists its variants', () => {
    const species = characterOptions(pack, { level: 1 }).species;
    const elf = species.find((s) => s.key === 'elf')!;
    const igni = species.find((s) => s.key === 'igni')!;
    assert.deepEqual(elf.subspecies.map((s) => s.name), ['Dawn Elf']);
    assert.deepEqual(elf.variants, []);
    assert.deepEqual(igni.subspecies, []);
    assert.deepEqual(igni.variants, ['Ember', 'Ash']);
});

test('only top-level species are listed, in sort order', () => {
    const names = characterOptions(pack, { level: 1 }).species.map((s) => s.name);
    assert.deepEqual(names, ['Elf', 'Igni']);   // Dawn Elf is inside Elf, not on its own
});

test('feature choices follow the role, the level and the calling', () => {
    const at1 = characterOptions(pack, { level: 1, role_id: 10 }).features.map((f) => f.name);
    assert.deepEqual(at1, ['Preferred Arms']);   // the level-5 feature and the non-create feature stay out
    const at5 = characterOptions(pack, { level: 5, role_id: 10 }).features.map((f) => f.name);
    assert.deepEqual(at5, ['Preferred Arms', 'Later']);
    const reaper = characterOptions(pack, { level: 3, role_id: 10, calling_id: 100 }).features.map((f) => f.name);
    assert.deepEqual(reaper, ['Preferred Arms', 'Reap']);
    const hero = characterOptions(pack, { level: 3, role_id: 10, calling_id: 101 }).features.map((f) => f.name);
    assert.deepEqual(hero, ['Preferred Arms']);
    const tooSoon = characterOptions(pack, { level: 2, role_id: 10, calling_id: 100 }).features.map((f) => f.name);
    assert.deepEqual(tooSoon, ['Preferred Arms']);
});

test('feature picks: a good set passes, a bad one gets an error', () => {
    const features = choiceFeaturesFor(pack.roles[0], undefined, 1);
    const key = features[0].key;
    assert.deepEqual(checkChoicePicks(features, { [key]: ['Minor', 'Great'] }), { choices: { [key]: ['Minor', 'Great'] } });
    assert.ok('choices' in checkChoicePicks(features, null));
    const bad = [
        { [key]: ['Minor'] },            // not enough
        { [key]: ['Minor', 'Minor'] },   // twice
        { [key]: ['Minor', 'Bow'] },     // not in the list
        { 'class:nope:Nope:1': ['Minor'] },
        [],
    ];
    for (const picks of bad) assert.ok('error' in checkChoicePicks(features, picks), JSON.stringify(picks));
    // The same option from two rows of one feature is refused. Divine Blessing is allowed to repeat.
    const twice = [
        { key: 'class:warrior:Preferred Arms:1', name: 'Preferred Arms', level: 1, choose: 1, options: ['Minor', 'Great'], source: 'class' as const, optionInfo: {} },
        { key: 'class:warrior:Preferred Arms:2', name: 'Preferred Arms', level: 2, choose: 1, options: ['Minor', 'Great'], source: 'class' as const, optionInfo: {} },
    ];
    assert.ok('error' in checkChoicePicks(twice, { [twice[0].key]: ['Minor'], [twice[1].key]: ['Minor'] }));
    const blessing = { key: 'class:warrior:Divine Blessing:4', name: 'Divine Blessing', level: 4, choose: 1, options: ['+2 STR'], source: 'class' as const, optionInfo: {} };
    assert.ok('choices' in checkChoicePicks([blessing, { ...blessing, key: 'class:warrior:Divine Blessing:6', level: 6 }], {
        'class:warrior:Divine Blessing:4': ['+2 STR'],
        'class:warrior:Divine Blessing:6': ['+2 STR'],
    }, 6));
    assert.ok('error' in checkChoicePicks([blessing], { [blessing.key]: ['+2 STR'] }, 3));
});

test('alignments sorted, personality split by category', () => {
    const options = characterOptions(pack, { level: 1 });
    assert.deepEqual(options.alignments.map((a) => a.code), ['LG', 'CE']);
    assert.deepEqual(options.upbringings.map((p) => p.name), ['Orphan']);
    assert.deepEqual(options.lifestyles.map((p) => p.name), ['Wanderer']);
    assert.deepEqual(options.outlooks.map((p) => p.name), ['Hopeful']);
    assert.deepEqual(options.eyeColors, ['Brown', 'Green']);
});