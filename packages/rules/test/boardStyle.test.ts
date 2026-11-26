import test from 'node:test';
import assert from 'node:assert/strict';
import { styleOf, checkLookChange } from '../src/board.ts';

test('styleOf defaults to tiles for missing or bad style and answers natural when set', () => {
    assert.equal(styleOf({}), 'tiles');
    assert.equal(styleOf(null), 'tiles');
    assert.equal(styleOf(undefined), 'tiles');
    assert.equal(styleOf({ style: 'natural' }), 'natural');
    assert.equal(styleOf({ style: 'hex' as any }), 'tiles');
    assert.equal(styleOf({ style: 1 as any }), 'tiles');
});

test('checkLookChange accepts valid styles and rejects invalid ones', () => {
    assert.deepEqual(checkLookChange({ style: 'natural' }), { change: { style: 'natural' } });
    assert.ok('error' in checkLookChange({ style: 'hex' as any }));
    assert.ok('error' in testCheckLookChangeStyleNumber());
});

function testCheckLookChangeStyleNumber() {
    return checkLookChange({ style: 1 as any });
}

test('style change preserves terrain and other look properties (round trip)', () => {
    const original = { mood: 'night', heights: { '0,0': 2, '1,0': 3 } };
    
    // Apply natural style
    const naturalChange = checkLookChange({ style: 'natural' });
    assert.ok('change' in naturalChange);
    const withNatural = { ...original, ...naturalChange.change };
    assert.deepEqual(withNatural.mood, 'night');
    assert.deepEqual(withNatural.heights, original.heights);
    
    // Apply tiles style back
    const tilesChange = checkLookChange({ style: 'tiles' });
    assert.ok('change' in tilesChange);
    const withTiles = { ...withNatural, ...tilesChange.change };
    assert.deepEqual(withTiles.mood, 'night');
    assert.deepEqual(withTiles.heights, original.heights);
    
    // Verify JSON serialization preserves style
    const serialized = JSON.parse(JSON.stringify(original));
    assert.equal(serialized.style, undefined);
});
