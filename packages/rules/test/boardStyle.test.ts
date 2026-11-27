import test from 'node:test';
import assert from 'node:assert/strict';
import { styleOf, checkLookChange, applyLookChange, upgradeTerrain, type SceneLook, type Feature } from '../src/board.ts';

// T1: switching a board's style keeps its terrain exactly, and both styles reload as saved.

const lookWithStyle = (style: unknown) => ({ style }) as unknown as SceneLook;   // a bad value, as a database could hold

test('styleOf defaults to tiles for missing or bad style and answers natural when set', () => {
    assert.equal(styleOf({}), 'tiles');
    assert.equal(styleOf(null), 'tiles');
    assert.equal(styleOf(undefined), 'tiles');
    assert.equal(styleOf({ style: 'natural' }), 'natural');
    assert.equal(styleOf({ style: 'tiles' }), 'tiles');
    assert.equal(styleOf(lookWithStyle('hex')), 'tiles');
    assert.equal(styleOf(lookWithStyle(1)), 'tiles');
});

test('checkLookChange accepts valid styles and rejects invalid ones', () => {
    assert.deepEqual(checkLookChange({ style: 'natural' }), { change: { style: 'natural' } });
    assert.deepEqual(checkLookChange({ style: 'tiles' }), { change: { style: 'tiles' } });
    assert.ok('error' in checkLookChange({ style: 'hex' }));
    assert.ok('error' in checkLookChange({ style: 1 }));
});

// What the server keeps for a board: four JSON columns. Saving = JSON out, reloading = JSON back in.
type Saved = { terrain: string; surfaces: string; features: string; look: string };
const save = (b: { terrain: Record<string, string>; surfaces: Record<string, string>; features: Record<string, Feature>; look: SceneLook }): Saved =>
    ({ terrain: JSON.stringify(b.terrain), surfaces: JSON.stringify(b.surfaces), features: JSON.stringify(b.features), look: JSON.stringify(b.look) });
const reload = (s: Saved) => ({
    terrain: upgradeTerrain(JSON.parse(s.terrain)),            // the server reads a scene through upgradeTerrain (T0)
    surfaces: JSON.parse(s.surfaces) as Record<string, string>,
    features: JSON.parse(s.features) as Record<string, Feature>,
    look: JSON.parse(s.look) as SceneLook,
});
// The server's PUT /scenes/:id/look: check the change, apply it to the look, save the look
function switchStyle(saved: Saved, style: string): Saved {
    const checked = checkLookChange({ style });
    assert.ok('change' in checked);
    return { ...saved, look: JSON.stringify(applyLookChange(JSON.parse(saved.look), checked.change)) };
}

const painted = {
    terrain: { '0,0': 'rough', '1,0': 'deep', '2,-1': 'block', '-1,1': 'slick', '0,2': 'steep' },
    surfaces: { '0,0': 'dirt', '1,1': 'cobble', '-2,0': 'snow' },
    features: { '3,0': { kind: 'tree' }, '0,-2': { kind: 'light', size: 1.5, color: '#ffd08a' } } as Record<string, Feature>,
    look: { mood: 'night', weather: 'fog', heights: { '0,2': 3, '1,1': 1 }, radius: 14 } as SceneLook,
};

test('switching Tiles -> Natural -> Tiles keeps the terrain, surfaces, features and the rest of the look exactly', () => {
    const tiles = save(painted);
    const natural = reload(switchStyle(tiles, 'natural'));
    assert.equal(styleOf(natural.look), 'natural');
    assert.deepEqual(natural.terrain, painted.terrain);
    assert.deepEqual(natural.surfaces, painted.surfaces);
    assert.deepEqual(natural.features, painted.features);
    assert.deepEqual({ ...natural.look, style: undefined }, { ...painted.look, style: undefined });

    const back = reload(switchStyle(switchStyle(tiles, 'natural'), 'tiles'));
    assert.equal(styleOf(back.look), 'tiles');
    assert.deepEqual({ ...back, look: { ...back.look, style: undefined } }, { ...painted, look: { ...painted.look, style: undefined } });
});

test('both styles reload as saved, and a board saved before styles existed reloads as Tiles', () => {
    for (const style of ['tiles', 'natural'] as const) {
        const once = reload(switchStyle(save(painted), style));
        assert.equal(styleOf(once.look), style);
        const twice = reload(save(once));                     // save and reload again: nothing drifts
        assert.deepEqual(twice, once);
    }
    assert.equal(styleOf(reload(save(painted)).look), 'tiles');
});

test('a bad style change is refused and the saved look is left alone', () => {
    const saved = switchStyle(save(painted), 'natural');
    const checked = checkLookChange({ style: 'watercolour' });
    assert.ok('error' in checked);
    assert.equal(styleOf(reload(saved).look), 'natural');
});
