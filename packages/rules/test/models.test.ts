import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canSee } from '../src/sight.ts';
import {
    BOARD_MODELS, footprintHexes, modelById, modelFootprint, modelOf, wallsOf, sightOf, stepCost, findWalk,
    type Board, type Feature,
} from '../src/board.ts';

test('the model library has a boulder with a one-hex footprint that blocks movement and sight', () => {
    const boulder = modelById('boulder');
    assert.ok(boulder);
    assert.equal(boulder.file, '/models/boulder/boulder.glb');
    assert.deepEqual([...boulder.footprint], [{ q: 0, r: 0 }]);
    assert.equal(boulder.blocksMovement, true);
    assert.equal(boulder.blocksSight, true);
    assert.equal(modelOf({ kind: 'boulder' })?.id, 'boulder');
    assert.ok(BOARD_MODELS.some((m) => m.id === 'boulder'));
});

test('footprintHexes shifts a footprint to the origin hex', () => {
    assert.deepEqual(footprintHexes({ q: 2, r: 3 }, [{ q: 0, r: 0 }, { q: 1, r: 0 }]), [{ q: 2, r: 3 }, { q: 3, r: 3 }]);
    assert.deepEqual(modelFootprint({ q: 1, r: 0 }, { kind: 'boulder' }), [{ q: 1, r: 0 }]);
});

test('a boulder model placed on a hex blocks the move into it and sight through it', () => {
    const features: Record<string, Feature> = { '1,0': { kind: 'boulder' } };
    const board: Board = { features };
    assert.equal(stepCost(board, '0,0', '1,0'), null);
    assert.ok(wallsOf({}, features).has('1,0'));
    assert.ok(sightOf({}, features).has('1,0'));
    assert.equal(canSee({ q: 0, r: 0 }, { q: 2, r: 0 }, sightOf({}, features)), false);
    assert.equal(canSee({ q: 0, r: 0 }, { q: 1, r: 0 }, sightOf({}, features)), true);
    const walk = findWalk({ q: 0, r: 0 }, { q: 2, r: 0 }, board, 6);
    assert.ok(walk);
    assert.ok(!walk.path.some((h) => h.q === 1 && h.r === 0));
});

test('the rules use a model footprint, not just the origin hex', () => {
    const origin = { q: 0, r: 0 };
    const wide = footprintHexes(origin, [{ q: 0, r: 0 }, { q: 1, r: 0 }]);
    assert.deepEqual(wide.map((h) => `${h.q},${h.r}`), ['0,0', '1,0']);
    // a one-hex boulder still only occupies its own hex
    assert.ok(!wallsOf({}, { '0,0': { kind: 'boulder' } }).has('1,0'));
});

test('a library model placed as kind model uses its flags and footprint', () => {
    const chest = modelById('treasure_chest');
    assert.ok(chest);
    assert.equal(chest.blocksMovement, false);
    assert.equal(modelOf({ kind: 'model', model: 'treasure_chest' })?.id, 'treasure_chest');
    const features: Record<string, Feature> = { '1,0': { kind: 'model', model: 'treasure_chest' } };
    assert.equal(stepCost({ features }, '0,0', '1,0'), 1);
    assert.equal(wallsOf({}, features).has('1,0'), false);

    const tree = modelById('fir_tree_01');
    assert.ok(tree);
    assert.ok(tree.footprint.length > 1);
    assert.equal(tree.blocksMovement, true);
    const blocked = wallsOf({}, { '0,0': { kind: 'model', model: 'fir_tree_01' } });
    assert.ok(blocked.has('0,0'));
    assert.ok(blocked.has('1,0'));
});

