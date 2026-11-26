import test from 'node:test';
import assert from 'node:assert/strict';
import { BOARD_SIZES, DEFAULT_BOARD_RADIUS, MAX_BOARD_RADIUS, isBoardSize, onBoard, hexesWithin, radiusOf, keepOnBoard, checkLookChange } from '../src/board.ts';

test('the size options are a list; the default is one of them and the biggest is the max', () => {
    assert.ok(Array.isArray(BOARD_SIZES) && BOARD_SIZES.length > 1);
    assert.ok(isBoardSize(DEFAULT_BOARD_RADIUS));
    assert.equal(MAX_BOARD_RADIUS, Math.max(...BOARD_SIZES));
    assert.equal(isBoardSize(11), false);
    assert.equal(isBoardSize('12'), false);
});

test('radiusOf: a board keeps its own size; old boards (no radius) use the previous 12', () => {
    assert.equal(DEFAULT_BOARD_RADIUS, 12);
    assert.equal(radiusOf({}), 12);
    assert.equal(radiusOf(null), 12);
    assert.equal(radiusOf({ radius: 18 }), 18);
    assert.equal(radiusOf({ radius: 7 }), 12);          // not an allowed size: ignored
});

test('onBoard follows the radius it is given', () => {
    assert.equal(onBoard({ q: 12, r: 0 }), true);
    assert.equal(onBoard({ q: 13, r: 0 }), false);
    assert.equal(onBoard({ q: 13, r: 0 }, 14), true);
    assert.equal(onBoard({ q: 11, r: 0 }, 10), false);
    assert.equal(hexesWithin({ q: 0, r: 0 }, 10).length, 331);
});

test('keepOnBoard drops hexes outside a smaller board', () => {
    const map = { '0,0': 'a', '10,0': 'b', '12,0': 'c', '-11,0': 'd' };
    assert.deepEqual(keepOnBoard(map, 10), { '0,0': 'a', '10,0': 'b' });
    assert.deepEqual(keepOnBoard(map, 30), map);
    assert.deepEqual(keepOnBoard(undefined, 10), {});
});

test('checkLookChange accepts only the listed radii', () => {
    assert.deepEqual(checkLookChange({ radius: 22 }), { change: { radius: 22 } });
    assert.ok('error' in checkLookChange({ radius: 13 }));
    assert.ok('error' in checkLookChange({ radius: '22' }));
});
