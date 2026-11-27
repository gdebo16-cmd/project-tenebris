import test from 'node:test';
import assert from 'node:assert/strict';
import { upgradeTerrain, cellAt, stepCost, findWalk, wallsOf, OBJECT_KINDS, OBJECT_RULES, type Board, type Feature, type ObjectKind } from '../src/board.ts';

// T0: one terrain model. An old board converts with nothing lost, and walks resolve the way the server resolves them.

const oldBoard = {
    terrain: { '0,1': 'wall', '1,0': 'water', '2,0': 'ice', '3,0': 'rough', '4,0': 'lava' },
    surfaces: { '0,1': 'cobble', '1,0': 'dirt' },
    features: { '0,1': { kind: 'light', color: '#ffeeaa' } } as Record<string, Feature>,
    heights: { '3,0': 2 },
};

test('an old board converts: old rule names renamed, every hex kept, nothing else touched', () => {
    const terrain = upgradeTerrain(oldBoard.terrain);
    assert.deepEqual(terrain, { '0,1': 'block', '1,0': 'deep', '2,0': 'slick', '3,0': 'rough', '4,0': 'lava' });
    assert.deepEqual(upgradeTerrain(terrain), terrain);                       // converting twice changes nothing
    assert.equal(oldBoard.terrain['0,1'], 'wall');                            // the old map isn't changed in place
    assert.deepEqual(upgradeTerrain(null), {});
});

test('an old board means the same after converting: walls still block, water and ice keep their rules', () => {
    assert.deepEqual([...wallsOf(oldBoard.terrain)], ['0,1']);
    const before = cellAt(oldBoard, '0,1');
    const after = cellAt({ ...oldBoard, terrain: upgradeTerrain(oldBoard.terrain) }, '0,1');
    assert.deepEqual(after, before);
    assert.deepEqual(before, { ground: { look: 'cobble', rules: [] }, objects: [{ kind: 'wall' }, { kind: 'light', color: '#ffeeaa' }], height: 0 });
    assert.deepEqual(cellAt(oldBoard, '1,0').ground, { look: 'dirt', rules: ['deep'] });
    assert.deepEqual(cellAt(oldBoard, '2,0').ground, { look: 'grass', rules: ['slick'] });
});

test('steep comes from heights when stepping up 2 levels or more, and only going up', () => {
    const board: Board = { heights: { '1,0': 1, '2,0': 3 } };
    assert.deepEqual(cellAt(board, '1,0', '0,0').ground.rules, []);
    assert.deepEqual(cellAt(board, '2,0', '1,0').ground.rules, ['steep']);
    assert.deepEqual(cellAt(board, '1,0', '2,0').ground.rules, []);
});

const into = (board: Board, walker = {}) => findWalk({ q: 0, r: 0 }, { q: 1, r: 0 }, board, 20, walker);

test('moves through rough, steep, slick and deep water cost what the rules say', () => {
    assert.equal(into({})?.cost, 1);
    assert.equal(into({ terrain: { '1,0': 'rough' } })?.cost, 2);
    assert.equal(into({ terrain: { '1,0': 'steep' } })?.cost, 3);
    assert.equal(into({ heights: { '1,0': 2 } })?.cost, 3);                  // steep from heights
    assert.equal(into({ heights: { '1,0': 1 } })?.cost, 1);                  // a gentle rise is free
    const slick = into({ terrain: { '1,0': 'slick' } });
    assert.equal(slick?.cost, 1);
    assert.deepEqual(slick?.slick, ['1,0']);                                  // for the Balance prompt
    const deep = into({ terrain: { '1,0': 'deep' } });
    assert.equal(deep?.cost, 2);                                              // no swim speed: walk halved
    assert.deepEqual(deep?.deep, ['1,0']);
    assert.equal(into({ terrain: { '1,0': 'deep' } }, { swims: true })?.cost, 1);
});

test('deep water halves what is left of a walk: two water hexes need 4 movement, or 2 with a swim speed', () => {
    const board: Board = { terrain: { '1,0': 'deep', '2,0': 'deep' } };
    assert.equal(findWalk({ q: 0, r: 0 }, { q: 2, r: 0 }, board, 3), null);
    assert.equal(findWalk({ q: 0, r: 0 }, { q: 2, r: 0 }, board, 4)?.cost, 4);
    assert.equal(findWalk({ q: 0, r: 0 }, { q: 2, r: 0 }, board, 2, { swims: true })?.cost, 2);
});

test('each object kind: blockers refuse the hex, underbrush costs +1, short props +2 to climb, lights nothing', () => {
    const expected: Record<string, number | null> = { block: null, rough: 2, climb: 3, none: 1 };
    for (const kind of OBJECT_KINDS) {
        const board: Board = kind === 'wall' ? { terrain: { '1,0': 'block' } } : { features: { '1,0': { kind: kind as Exclude<ObjectKind, 'wall'> } } };
        assert.equal(stepCost(board, '0,0', '1,0'), expected[OBJECT_RULES[kind]], kind);
        assert.equal(into(board)?.cost ?? null, expected[OBJECT_RULES[kind]], kind);
    }
    assert.deepEqual(['wall', 'tree', 'boulder', 'pillar'].map((k) => OBJECT_RULES[k as ObjectKind]), ['block', 'block', 'block', 'block']);
});

test('walking past a blocker goes around it, and a budget too small for the way around is refused', () => {
    const board: Board = { features: { '1,0': { kind: 'tree' } } };
    const walk = findWalk({ q: 0, r: 0 }, { q: 2, r: 0 }, board, 6);
    assert.equal(walk?.cost, 3);
    assert.ok(walk && !walk.path.some((h) => h.q === 1 && h.r === 0));
    assert.equal(findWalk({ q: 0, r: 0 }, { q: 2, r: 0 }, board, 2), null);
    // the cheapest way: around a rough patch rather than through it when that's cheaper
    const rough: Board = { terrain: { '1,0': 'rough', '2,0': 'rough', '3,0': 'rough' } };
    assert.equal(findWalk({ q: 0, r: 0 }, { q: 4, r: 0 }, rough, 20)?.cost, 5);
});

test('a walk stays on the board when given its radius', () => {
    assert.equal(findWalk({ q: 0, r: 0 }, { q: 3, r: 0 }, {}, 10, { radius: 2 }), null);
    assert.equal(findWalk({ q: 0, r: 0 }, { q: 2, r: 0 }, {}, 10, { radius: 2 })?.cost, 2);
});
