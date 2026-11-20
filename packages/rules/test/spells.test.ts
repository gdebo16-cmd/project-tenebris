import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getSpellSlots, beamsAt, beamRollText, beamDamageText, scaledAt } from '../src/spellSlots.ts';
import { getLearnLimits, getSpellCaps, bodyMaxLevel } from '../src/spellLimits.ts';
import { runesPerItem, activeRunes, runeFitsItem } from '../src/runeLimits.ts';

test('getSpellSlots uses class data when there is some', () => {
    assert.deepEqual(getSpellSlots(5, [4, 2]), [4, 2]);
    assert.deepEqual(getSpellSlots(5, []), []);           // [] = this class has no slots
});

test('getSpellSlots falls back to the table, capped to levels 1-30', () => {
    assert.deepEqual(getSpellSlots(1), [2]);
    assert.deepEqual(getSpellSlots(5), [4, 3, 2]);
    assert.deepEqual(getSpellSlots(99), getSpellSlots(30));
    assert.deepEqual(getSpellSlots(0), getSpellSlots(1));
});

test('beamsAt reads the beam scaling', () => {
    const spell = { beam_scaling: [{ level: 5, beams: 2 }, { level: 11, beams: 3 }] };
    assert.equal(beamsAt(spell, 1), 1);
    assert.equal(beamsAt(spell, 5), 2);
    assert.equal(beamsAt(spell, 20), 3);
    assert.equal(beamsAt(null, 20), 1);
});

test('scaledAt picks the last step reached', () => {
    const steps = [{ level: 5, dice: 2 }, { level: 11, dice: 3 }];
    assert.equal(scaledAt(steps, 'dice', 4, 1), 1);
    assert.equal(scaledAt(steps, 'dice', 11, 1), 3);
});

test('beam text for the roll feed', () => {
    const hit = { natural: 20, total: 25, crit: true, fail: false };
    const miss = { natural: 1, total: 6, crit: false, fail: true };
    assert.equal(beamRollText([{ hit, damage: 9 }, { hit: miss, damage: 2 }]),
        'Beam 1: to hit 25 CRIT!, damage 9 | Beam 2: to hit 6 (natural 1), damage 2');
    assert.equal(beamDamageText([5, 3]), 'Damage dealt: 5 + 3 = 8 (2 beams)');
    assert.equal(beamDamageText([5, 3], true), 'Damage dealt: 5 + 3 = 8 (2 beams) CRIT!');
});

test('spell learn limits', () => {
    assert.deepEqual(getLearnLimits('Mage', 1), { cantrips: 3, spells: 5, knownOnly: false, shared: false });
    assert.deepEqual(getLearnLimits('mage', 1), getLearnLimits('Mage', 1));   // any capitalization
    assert.equal(getLearnLimits('Nobody', 1), null);
    // prepared casters can know twice what they prepare
    assert.deepEqual(getSpellCaps('Mage', 1), { cantrips: 3, prepared: 5, known: 10 });
    // Reaver casts straight from what it knows
    assert.equal(getSpellCaps('Reaver', 2)?.known, 2);
});

test('Body Magic levels', () => {
    assert.equal(bodyMaxLevel(4), 0);
    assert.equal(bodyMaxLevel(5), 1);
    assert.equal(bodyMaxLevel(25), 3);
});

test('rune limits', () => {
    assert.equal(runesPerItem(1), 0);
    assert.equal(runesPerItem(3), 1);
    assert.equal(activeRunes(30), 8);
    assert.equal(activeRunes(99), 8);         // capped at level 30
    assert.equal(runeFitsItem(['weapon'], 'weapon'), true);
    assert.equal(runeFitsItem(['gear'], 'armor'), true);    // gear runes go on armor
    assert.equal(runeFitsItem(['gear'], 'weapon'), false);
});
