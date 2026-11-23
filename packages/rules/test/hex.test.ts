import { test } from 'node:test';
import assert from 'node:assert/strict';
import { distance, neighbors, hexKey, findPath } from '../src/hex.ts';

test('distance counts the fewest steps between two hexes', () => {
    assert.equal(distance({q:0,r:0}, {q:2,r:2}), 4)
    assert.equal(distance({q:0,r:0}, {q:2,r:-2}), 2);
    assert.equal(distance({q:1,r:0}, {q:2,r:0}), 1);
    assert.equal(distance({q:0,r:0}, {q:0,r:0}), 0);
});

test('neighbors are the six hexes one step away', () => {
    assert.equal(neighbors({ q: 0, r: 0 }).length, 6);
    assert.deepEqual(neighbors({ q: 2, r: 1 }), [
        { q: 3, r: 1 }, { q: 3, r: 0 }, { q: 2, r: 0 },
        { q: 1, r: 1 }, { q: 1, r: 2 }, { q: 2, r: 2 },
    ]);
});

test('hexKey turns a hex into text', () => {
    assert.equal(hexKey({ q: -1, r: 1 }), '-1,1');
});

test('findPath walks around a wall', () => {
    const walls = new Set(['1,0', '1,-1', '0,1']);
    const path = findPath({ q: 0, r: 0 }, { q: 2, r: 0 }, walls);

    assert.ok(path);                                            // a path was found
    assert.deepEqual(path[0], { q: 0, r: 0 });                  // starts at the start
    assert.deepEqual(path[path.length - 1], { q: 2, r: 0 });    // ends at the goal
    assert.equal(path.length, 6);                               // 5 steps, plus the start
    assert.ok(path.every((h) => !walls.has(hexKey(h))));        // never steps on a wall
});