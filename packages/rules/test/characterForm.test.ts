import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkHeader, checkRoleTab, checkSpeciesTab, checkStatRollBody, checkTraitsTab, clearedCalling, finishedFormBlock, keepUnrelatedChoices, missingForFinish, rerollAllowed, startingHp, type Options } from '../src/characterForm.ts';

// Only the parts of the options the species check reads
const options = {
    eyeColors: ['Brown', 'Green'],
    species: [
        { id: 1, key: 'igni', name: 'Igni', image: null, sizes: [{ id: 2, name: 'Small' }, { id: 3, name: 'Medium' }], subspecies: [], variants: ['Ember', 'Ash'] },
        { id: 2, key: 'elf', name: 'Elf', image: null, sizes: [{ id: 3, name: 'Medium' }], subspecies: [{ id: 20, name: 'Dawn Elf', image: null }], variants: [] },
    ],
} as unknown as Options;

test('header: good bodies pass and come back clean', () => {
    assert.deepEqual(checkHeader({ name: '  Ash  ', level: 3 }), { values: { name: 'Ash', level: 3, portrait_url: null } });
    assert.deepEqual(checkHeader({ name: 'Ash', level: '5', portrait_url: '/portraits/a.png' }),
        { values: { name: 'Ash', level: 5, portrait_url: '/portraits/a.png' } });
    assert.deepEqual(checkHeader({ name: 'Ash' }), { values: { name: 'Ash', level: 1, portrait_url: null } });   // level defaults to 1
});

test('header: bad bodies get an error', () => {
    const bad = [
        null,
        { name: '' },
        { name: '   ' },
        { name: 'x'.repeat(61) },
        { name: 'Ash', level: 0 },
        { name: 'Ash', level: 31 },
        { name: 'Ash', level: 2.5 },
        { name: 'Ash', portrait_url: 'https://evil.example/x.png' },
    ];
    for (const body of bad) assert.ok('error' in checkHeader(body), JSON.stringify(body));
});

test('species: a species with variants saves its own id and the variant', () => {
    assert.deepEqual(checkSpeciesTab(options, { species_id: 1, size_id: 2, variant: 'Ash', eye_color: 'Green' }),
        { values: { species_id: 1, size_id: 2, variant: 'Ash', eye_color: 'Green', look_description: null } });
});

test('species: a species with sub-species saves the sub-species id', () => {
    const result = checkSpeciesTab(options, { species_id: 2, subspecies_id: 20, size_id: 3, eye_color: 'Brown', look_description: ' tall ' });
    assert.deepEqual(result, { values: { species_id: 20, size_id: 3, variant: null, eye_color: 'Brown', look_description: 'tall' } });
});

test('species: bad bodies get an error', () => {
    const bad = [
        {},
        { species_id: 99, size_id: 3, eye_color: 'Brown' },                          // no such species
        { species_id: 1, size_id: 4, variant: 'Ash', eye_color: 'Brown' },           // size not allowed (Large for Igni)
        { species_id: 1, size_id: 2, variant: 'Gold', eye_color: 'Brown' },          // variant not in the list
        { species_id: 1, size_id: 2, eye_color: 'Brown' },                           // variant missing
        { species_id: 2, size_id: 3, eye_color: 'Brown' },                           // sub-species missing
        { species_id: 2, subspecies_id: 99, size_id: 3, eye_color: 'Brown' },        // sub-species of another species
        { species_id: 1, size_id: 2, variant: 'Ash', eye_color: 'Plaid' },           // eye color not in the list
        { species_id: 1, size_id: 2, variant: 'Ash', eye_color: 'Brown', look_description: 'x'.repeat(1001) },
    ];
    for (const body of bad) assert.ok('error' in checkSpeciesTab(options, body), JSON.stringify(body));
});

test('missingForFinish lists what each tab still needs', () => {
    assert.deepEqual(missingForFinish({ name: 'Ash' }), [
        'Species & look: species, size and eye color',
        'Role & calling: a role',
        'Traits & gifts: place all 8 stat rolls',
    ]);
    const done = { name: 'Ash', species_id: 1, size_id: 3, eye_color: 'Brown', role_id: 1, str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10, luc: 10, spd: 10 };
    assert.deepEqual(missingForFinish(done), []);
});

const arms = { key: 'class:warrior:Preferred Arms:1', name: 'Preferred Arms', level: 1, choose: 2, options: ['Minor', 'Great', 'Reach'], source: 'class' as const, optionInfo: {} };

// Level 1: no callings. Skills choose 2. One feature picker.
const roleOptions = {
    roles: [{ id: 10, key: 'warrior', name: 'Warrior', hit_die: 'd12', primary_stat: 'Might', image: null }],
    callings: [],
    skills: { choose: 2, from: ['Balance', 'Presence', 'Awareness'], fixed: ['Athletics'] },
    features: [arms],
} as unknown as Options;

const roleAt3 = {
    ...roleOptions,
    callings: [{ id: 100, key: 'reaper', name: 'Path of the Reaper', description: null, image: null }],
} as unknown as Options;

const goodRole = { role_id: 10, skills: ['Balance', 'Presence'], feature_choices: { [arms.key]: ['Minor', 'Great'] } };

test('role: a good body passes, and fixed skills are saved with the picks', () => {
    const saved = checkRoleTab(roleOptions, goodRole);
    assert.ok('values' in saved);
    if (!('values' in saved)) return;
    assert.equal(saved.values.role_id, 10);
    assert.equal(saved.values.calling_id, null);
    assert.deepEqual(saved.values.skill_proficiencies, ['Athletics', 'Balance', 'Presence']);
    assert.deepEqual(saved.values.feature_choices, { [arms.key]: ['Minor', 'Great'] });
    const withCalling = checkRoleTab(roleAt3, { ...goodRole, calling_id: 100 });
    assert.ok('values' in withCalling && withCalling.values.calling_id === 100);
});

test('role: a calling below level 3, or a skill that is not offered, gets an error', () => {
    const bad = [
        { ...goodRole, calling_id: 100 },                         // callings are closed at this level
        { ...goodRole, skills: ['Balance', 'Stealth'] },          // Stealth is not in the list
        { ...goodRole, skills: ['Balance'] },                     // not enough
        { ...goodRole, skills: ['Balance', 'Athletics'] },        // already given
        { ...goodRole, skills: ['Balance', 'Balance'] },
        { role_id: 99, skills: ['Balance', 'Presence'] },
        { ...goodRole, feature_choices: { [arms.key]: ['Bow', 'Great'] } },
    ];
    for (const body of bad) assert.ok('error' in checkRoleTab(roleOptions, body), JSON.stringify(body));
    const wrongCalling = checkRoleTab(roleAt3, { ...goodRole, calling_id: 999 });
    assert.ok('error' in wrongCalling && wrongCalling.error.includes('not part of this role'));
});

test('dropping below level 3 clears the calling and its picks, and keeps the role picks', () => {
    const cleared = clearedCalling({
        [arms.key]: ['Minor', 'Great'],
        'subclass:reaper:Reap:3': ['Hook'],
        'class:warrior:Divine Blessing:4': ['+2 STR'],
    });
    assert.equal(cleared.calling_id, null);
    assert.deepEqual(cleared.feature_choices, {
        [arms.key]: ['Minor', 'Great'],
        'class:warrior:Divine Blessing:4': ['+2 STR'],
    });
    const kept = keepUnrelatedChoices(
        { 'class:warrior:Divine Blessing:4': ['+2 STR'], 'subclass:reaper:Reap:3': ['Hook'] },
        { [arms.key]: ['Minor', 'Great'] },
        [arms],
        false,
    );
    assert.deepEqual(kept['class:warrior:Divine Blessing:4'], ['+2 STR']);
    assert.equal(kept['subclass:reaper:Reap:3'], undefined);
    const swapped = keepUnrelatedChoices({ 'class:mage:Old:1': ['A'] }, {}, [], true);
    assert.deepEqual(swapped, {});
});

const giftOptions = {
    gifts: { choose: 1, from: [{ id: 1, name: 'Steady' }, { id: 2, name: 'Swift' }] },
} as unknown as Options;

// total: 999 is a lie. The check must use the dice (sum minus the dropped die).
const stored = {
    rolls: [
        { rolls: [6, 6, 6, 1], dropped: 1, total: 999 },
        { rolls: [5, 5, 5, 2], dropped: 2, total: 1 },
        { rolls: [4, 4, 4, 3], dropped: 3, total: 1 },
        { rolls: [3, 3, 3, 1], dropped: 1, total: 1 },
        { rolls: [6, 5, 4, 1], dropped: 1, total: 1 },
        { rolls: [6, 5, 3, 1], dropped: 1, total: 1 },
        { rolls: [6, 4, 3, 1], dropped: 1, total: 1 },
        { rolls: [5, 4, 3, 1], dropped: 1, total: 1 },
    ],
};
const allPlaced = { str: 0, dex: 1, con: 2, int: 3, wis: 4, cha: 5, luc: 6, spd: 7 };

test('traits: scores are the stored rolls plus bonuses, not numbers from the browser', () => {
    const saved = checkTraitsTab(giftOptions, stored, { placement: allPlaced, plus2: 'str', plus1: 'str', gifts: [1], str: 99 });
    assert.ok('values' in saved);
    if (!('values' in saved)) return;
    assert.equal(saved.values.str, 18 + 3);   // 6+6+6+1, drop a 1, then +2 and +1 on the same stat
    assert.equal(saved.values.dex, 15);
    assert.equal(saved.values.plus2_stat, 'str');
    assert.equal(saved.values.plus1_stat, 'str');
    assert.deepEqual((saved.values.stat_rolls as { gifts: number[] }).gifts, [1]);
});

test('traits: a bad placement, an unrolled index, or too many gifts gets an error', () => {
    const bad = [
        { placement: { ...allPlaced, dex: 0 }, plus2: 'str', plus1: 'dex' },
        { placement: { ...allPlaced, str: 8 }, plus2: 'str', plus1: 'dex' },
        { placement: { dex: 1, con: 2, int: 3, wis: 4, cha: 5, luc: 6, spd: 7 }, plus2: 'str', plus1: 'dex' },
        { placement: allPlaced, plus2: 'str', plus1: 'nope' },
        { placement: allPlaced, plus2: 'str', plus1: 'dex', gifts: [1, 2] },
        { placement: allPlaced, plus2: 'str', plus1: 'dex', gifts: [9] },
        { placement: allPlaced, plus2: 'str', plus1: 'dex', gifts: [1, 1] },
    ];
    for (const body of bad) assert.ok('error' in checkTraitsTab(giftOptions, stored, body), JSON.stringify(body));
    const unrolled = { rolls: stored.rolls.map((roll, i) => i === 0 ? null : roll) };
    assert.ok('error' in checkTraitsTab(giftOptions, unrolled, { placement: allPlaced, plus2: 'str', plus1: 'dex' }));
});

test('a finished character keeps role and traits on the old editor until R4.9', () => {
    assert.equal(finishedFormBlock('role', true), null);
    assert.equal(finishedFormBlock('traits', true), null);
    assert.equal(finishedFormBlock('header', false), null);
    assert.match(finishedFormBlock('role', false) ?? '', /old editor/);
    assert.match(finishedFormBlock('traits', false) ?? '', /old editor/);
});

test('stat roll requests: an index, or one reset, and rerolls lock after finish', () => {
    assert.deepEqual(checkStatRollBody({ index: 0 }), { index: 0 });
    assert.deepEqual(checkStatRollBody({ index: '7' }), { index: 7 });
    assert.deepEqual(checkStatRollBody({ reset: 'rolls' }), { reset: 'rolls' });
    assert.ok('error' in checkStatRollBody({ index: 8 }));
    assert.ok('error' in checkStatRollBody({ index: 1, reset: 'rolls' }));
    assert.ok('ok' in rerollAllowed(true));
    const locked = rerollAllowed(false);
    assert.ok('error' in locked && locked.error.includes('finished'));
});

test('startingHp matches the old creator', () => {
    assert.equal(startingHp(12, 14, 1, 7), 9);             // 7 + CON mod 2
    assert.equal(startingHp(12, 14, 3, 7), 9 + 2 * 9);      // + (6 + 1 + 2) per level after the first
    assert.equal(startingHp(6, 3, 1, 1), 1);               // never below 1 (1 - 4)
});
