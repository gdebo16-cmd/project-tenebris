import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isSurface, isCoreSurface, isLibraryPaint, paintById, LIBRARY_PAINTS, DEFAULT_SURFACE } from '../src/board.ts';

test('the paint library lists board-relevant Poly Haven looks and isSurface accepts them', () => {
    assert.ok(LIBRARY_PAINTS.length >= 40);
    assert.equal(isCoreSurface('grass'), true);
    assert.equal(isCoreSurface('forest_floor'), false);
    assert.equal(isLibraryPaint('forest_floor'), true);
    assert.equal(isSurface('forest_floor'), true);
    assert.equal(isSurface('grass'), true);
    assert.equal(isSurface('not-a-paint'), false);
    assert.equal(paintById('forest_floor')?.category, 'forest floor');
    assert.equal(DEFAULT_SURFACE, 'grass');
    const categories = new Set(LIBRARY_PAINTS.map((p) => p.category));
    for (const category of ['grass', 'moss', 'dirt', 'sand', 'snow', 'rock']) {
        assert.ok(categories.has(category), 'missing category ' + category);
    }
});