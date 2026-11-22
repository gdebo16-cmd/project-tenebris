import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rollInitiative, nextTurn, checkInitiativeRequest, initiativeOf, type Combatant } from '../src/initiative.ts';
import { fixedDice } from './helpers.ts';

const party: Combatant[] = [
    { kind: 'character', id: 1, name: 'Ash', bonus: 3 },
    { kind: 'monster', id: 7, name: 'Ash Hound', bonus: 6 },
    { kind: 'character', id: 2, name: 'Bram', bonus: 1 },
];

test('rollInitiative sorts by roll, then bonus, then characters first', () => {
    // Ash 10+3 = 13, Hound 7+6 = 13, Bram 15+1 = 16
    const s = rollInitiative(party, fixedDice(10, 7, 15));
    assert.equal(s.round, 1);
    assert.equal(s.turn, 0);
    assert.deepEqual(s.order.map((e) => [e.name, e.roll]), [['Bram', 16], ['Ash Hound', 13], ['Ash', 13]]);
});

test('ties on roll and bonus: characters before monsters', () => {
    const s = rollInitiative([{ kind: 'monster', id: 7, name: 'A', bonus: 2 }, { kind: 'character', id: 1, name: 'Z', bonus: 2 }], fixedDice(10, 10));
    assert.deepEqual(s.order.map((e) => e.name), ['Z', 'A']);
});

test('nextTurn wraps to a new round', () => {
    let s = rollInitiative(party, fixedDice(10, 7, 15));
    s = nextTurn(s); s = nextTurn(s);
    assert.deepEqual([s.round, s.turn], [1, 2]);
    s = nextTurn(s);
    assert.deepEqual([s.round, s.turn], [2, 0]);
    assert.deepEqual(nextTurn({ round: 1, turn: 0, order: [] }), { round: 1, turn: 0, order: [] });
});

test('checkInitiativeRequest and initiativeOf', () => {
    assert.deepEqual(checkInitiativeRequest({ op: 'next' }), { op: 'next' });
    assert.ok('error' in checkInitiativeRequest({ op: 'skip' }));
    assert.equal(initiativeOf(null), null);
    assert.equal(initiativeOf({ order: 'x' }), null);
    assert.deepEqual(initiativeOf({ round: 2, turn: 9, order: [{ name: 'a' }] }), { round: 2, turn: 0, order: [{ name: 'a' }] });
});
