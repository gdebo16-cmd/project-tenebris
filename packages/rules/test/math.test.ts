import { test } from 'node:test';
import assert from 'node:assert/strict';
import { modOf, signed, healthInit, proficiencyBonus, capitalize } from '../src/math.ts';

test('modOf turns a score into a modifier', () => {
    assert.equal(modOf(10), 0);
    assert.equal(modOf(11), 0);
    assert.equal(modOf(16), 3);
    assert.equal(modOf(7), -2);
    assert.equal(modOf('18'), 4);   // scores sometimes arrive as text
});

test('signed puts a + in front of zero and positives', () => {
    assert.equal(signed(3), '+3');
    assert.equal(signed(0), '+0');
    assert.equal(signed(-1), '-1');
});

test('healthInit bands HP into 0-4', () => {
    assert.equal(healthInit(20, 20), 4);
    assert.equal(healthInit(15, 20), 3);
    assert.equal(healthInit(10, 20), 2);
    assert.equal(healthInit(5, 20), 1);
    assert.equal(healthInit(4, 20), 0);
    assert.equal(healthInit(5, 0), 0);  // no max HP means no band
});

test('proficiencyBonus goes up every 4 levels', () => {
    assert.equal(proficiencyBonus(1), 2);
    assert.equal(proficiencyBonus(4), 2);
    assert.equal(proficiencyBonus(5), 3);
    assert.equal(proficiencyBonus(30), 9);
});

test('capitalize', () => {
    assert.equal(capitalize('strength'), 'Strength');
    assert.equal(capitalize(null), '');
});
