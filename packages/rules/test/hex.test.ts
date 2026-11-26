import { test } from 'node:test';
import assert from 'node:assert/strict';
import { distance, neighbors, hexKey, findPath, hexesWithin, wallsOf, hexesForSpeed, isTerrainKind, checkLookChange } from '../src/board.ts';

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
    const path = findPath({ q: 0, r: 0 }, { q: 2, r: 0 }, walls, 10);

    assert.ok(path);                                            // a path was found
    assert.deepEqual(path[0], { q: 0, r: 0 });                  // starts at the start
    assert.deepEqual(path[path.length - 1], { q: 2, r: 0 });    // ends at the goal
    assert.equal(path.length, 6);                               // 5 steps, plus the start
    assert.ok(path.every((h) => !walls.has(hexKey(h))));        // never steps on a wall
});

test('findPath gives up when the start is walled in', () => {
    const walls = new Set(neighbors({ q: 0, r: 0 }).map(hexKey));   // all six ways out blocked
    assert.equal(findPath({ q: 0, r: 0 }, { q: 3, r: 0 }, walls, 10), null);
});

test('findPath stops at the max steps', () => {
    const walls = new Set(['1,0', '1,-1', '0,1']);
    assert.equal(findPath({ q: 0, r: 0 }, { q: 2, r: 0 }, walls, 3), null);
});

test('hexesWithin fills a hexagon: 1, 7, 19 hexes for radius 0, 1, 2', () => {
    assert.equal(hexesWithin({ q: 0, r: 0 }, 0).length, 1);
    assert.equal(hexesWithin({ q: 0, r: 0 }, 1).length, 7);
    assert.equal(hexesWithin({ q: 0, r: 0 }, 2).length, 19);
    assert.ok(hexesWithin({ q: 3, r: -1 }, 2).every((h) => distance({ q: 3, r: -1 }, h) <= 2));
});

test('checkLookChange keeps good changes and refuses bad ones', () => {
    assert.deepEqual(checkLookChange({ mood: 'night', room: true }), { change: { mood: 'night', room: true } });
    assert.deepEqual(checkLookChange({ map: { url: 'https://x.test/map.jpg' } }), { change: { map: { url: 'https://x.test/map.jpg', size: 30 } } });
    assert.ok('error' in checkLookChange({ mood: 'disco' }));
    assert.ok('error' in checkLookChange({ map: { url: 'javascript:alert(1)' } }));
    assert.ok('error' in checkLookChange({ map: { url: 'https://x.test/a.png', size: 500 } }));
    assert.ok('error' in checkLookChange({}));
});

test('wallsOf adds features that block (trees, boulders, pillars) but not the rest', () => {
    const walls = wallsOf({ '1,0': 'block' }, { '2,0': { kind: 'tree' }, '3,0': { kind: 'crate' }, '4,0': { kind: 'light', color: '#ffffff' } });
    assert.deepEqual([...walls].sort(), ['1,0', '2,0']);
});

test('wallsOf keeps only the terrain that blocks movement', () => {
    const walls = wallsOf({ '1,0': 'block', '2,0': 'deep', '3,0': 'rough', '0,1': 'block' });
    assert.deepEqual([...walls].sort(), ['0,1', '1,0']);
});

test('hexesForSpeed: 5 ft per hex, rounded down, never below 0', () => {
    assert.equal(hexesForSpeed(30), 6);
    assert.equal(hexesForSpeed(32), 6);
    assert.equal(hexesForSpeed(0), 0);
    assert.equal(hexesForSpeed(-10), 0);
});

test('isTerrainKind accepts only the paintable kinds', () => {
    assert.ok(isTerrainKind('block'));
    assert.ok(!isTerrainKind('lava'));
    assert.ok(!isTerrainKind(null));
});
