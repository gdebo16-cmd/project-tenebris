import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDice, rollDice, rollToHit, roll4d6DropLowest, rollBeams, checkRollRequest, rollAll } from '../src/dice.ts';
import { fixedDice, maxDice, minDice } from './helpers.ts';

test('parseDice reads dice text', () => {
    assert.deepEqual(parseDice('2d6+3'), { count: 2, sides: 6, bonus: 3 });
    assert.deepEqual(parseDice('3d4 + 3'), { count: 3, sides: 4, bonus: 3 });
    assert.deepEqual(parseDice('d8'), { count: 1, sides: 8, bonus: 0 });
    assert.deepEqual(parseDice('1d4-1'), { count: 1, sides: 4, bonus: -1 });
    assert.deepEqual(parseDice('5'), { count: 0, sides: 0, bonus: 5 });
    assert.deepEqual(parseDice(''), { count: 0, sides: 0, bonus: 0 });
    assert.equal(parseDice('banana'), null);
});

test('rollDice adds the dice and the bonus', () => {
    assert.deepEqual(rollDice('2d6+3', fixedDice(4, 5)), { total: 12, rolls: [4, 5] });
    assert.deepEqual(rollDice('1', minDice), { total: 1, rolls: [] });   // flat numbers roll nothing
});

test('a crit doubles the dice but not the bonus', () => {
    assert.deepEqual(rollDice('1d8+3', maxDice, true), { total: 19, rolls: [8, 8] });
});

test('rollDice refuses nonsense', () => {
    assert.throws(() => rollDice('banana', maxDice));
});

test('rollToHit: 20 is a crit, 1 is a fail', () => {
    assert.deepEqual(rollToHit(5, maxDice), { natural: 20, total: 25, crit: true, fail: false });
    assert.deepEqual(rollToHit(5, minDice), { natural: 1, total: 6, crit: false, fail: true });
    assert.deepEqual(rollToHit(-1, fixedDice(12)), { natural: 12, total: 11, crit: false, fail: false });
});

test('roll4d6DropLowest drops the lowest die', () => {
    assert.deepEqual(roll4d6DropLowest(fixedDice(3, 6, 1, 5)), { total: 14, rolls: [3, 6, 1, 5], dropped: 1 });
});

test('beams roll their own to-hit, and only a crit beam doubles its dice', () => {
    // beam 1: d20 = 20 (crit), then 2 dice for 1d6 -> 3 + 4; beam 2: d20 = 10, then 1 die -> 2
    const beams = rollBeams(2, 5, '1d6', 1, fixedDice(20, 3, 4, 10, 2));
    assert.equal(beams[0].hit.crit, true);
    assert.equal(beams[0].damage, 8);   // 3 + 4 + 1
    assert.equal(beams[1].hit.total, 15);
    assert.equal(beams[1].damage, 3);   // 2 + 1
});

test('beam damage never goes below 0, and no dice means no damage', () => {
    assert.equal(rollBeams(1, 0, '1d4', -5, fixedDice(10, 1))[0].damage, 0);
    assert.equal(rollBeams(1, 0, null, 0, fixedDice(10))[0].damage, null);
});

test('checkRollRequest accepts good requests', () => {
    const body = { rolls: { hit: { type: 'd20', bonus: 5 }, damage: { type: 'dice', dice: '1d8+3', crit: true }, stat: { type: 'stat' } } };
    assert.deepEqual(checkRollRequest(body), { rolls: body.rolls });
});

test('checkRollRequest refuses bad requests', () => {
    const bad = [
        null,
        {},
        { rolls: [] },
        { rolls: {} },
        { rolls: { a: { type: 'dice', dice: 'banana' } } },
        { rolls: { a: { type: 'dice', dice: '500d6' } } },
        { rolls: { a: { type: 'dice', dice: '1d99999' } } },
        { rolls: { a: { type: 'd20', bonus: 2.5 } } },
        { rolls: { a: { type: 'beams', beams: 0, toHit: 3 } } },
        { rolls: { a: { type: 'nuke' } } },
        { rolls: Object.fromEntries(Array.from({ length: 51 }, (_, i) => [`r${i}`, { type: 'percent' }])) },
    ];
    for (const body of bad) assert.ok('error' in checkRollRequest(body), JSON.stringify(body));
});

test('rollAll keeps the names', () => {
    const out = rollAll({ hit: { type: 'd20', bonus: 2 }, pct: { type: 'percent' } }, maxDice);
    assert.equal(out.hit.total, 22);
    assert.equal(out.pct, 100);
});
