import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    GRID, MAX_ITEMS, SHEET_BLOCKS, addBlock, checkLayout, hiddenBlocks, nudgeBlock, panelTabsOf, placeBlock, readingOrder, removeBlock, setPanelTabs,
    type SheetLayout,
} from '../src/layout.ts';

const BLOCKS = ['header', 'health', 'core', 'main'];
const good: SheetLayout = {
    version: 2,
    items: [
        { block: 'header', col: 1, row: 1, colSpan: 8, rowSpan: 2 },
        { block: 'main', col: 9, row: 1, colSpan: 4, rowSpan: 16 },
        { block: 'health', col: 1, row: 3, colSpan: 4, rowSpan: 3 },
        { block: 'core', col: 5, row: 3, colSpan: 4, rowSpan: 3 },
    ],
};
const at = (r: ReturnType<typeof placeBlock>, block: string) => ('layout' in r ? r.layout.items.find((i) => i.block === block) : undefined);

test('the grid is 12 × 16', () => {
    assert.deepEqual(GRID, { columns: 12, rows: 16 });
});

test('checkLayout accepts a good layout and drops unknown blocks', () => {
    assert.deepEqual(checkLayout(good, BLOCKS), { layout: good });
    const r = checkLayout({ ...good, items: [...good.items, { block: 'gone', col: 1, row: 6, colSpan: 1, rowSpan: 1 }] }, BLOCKS);
    assert.ok('layout' in r && r.layout.items.length === 4);
});

test('checkLayout refuses bad layouts, including the old version 1', () => {
    const bad = (f: (l: SheetLayout) => unknown) => checkLayout(f(structuredClone(good)), BLOCKS);
    assert.ok('error' in bad((l) => ({ ...l, version: 1 })));
    assert.ok('error' in bad((l) => { l.items[2].col = 6; return l; }), 'health onto core');
    assert.ok('error' in bad((l) => { l.items[1].colSpan = 5; return l; }), 'past column 12');
    assert.ok('error' in bad((l) => { l.items[1].rowSpan = 17; return l; }), 'past row 16');
    assert.ok('error' in bad((l) => { l.items[2].rowSpan = 0; return l; }));
    assert.ok('error' in bad((l) => { l.items[2].col = 1.5; return l; }));
    assert.ok('error' in bad((l) => { l.items.push({ ...l.items[2], row: 10 }); return l; }), 'health twice');
    assert.ok('error' in checkLayout(null, BLOCKS));
});

test('placeBlock: moves and resizes inside the grid, refuses overlaps', () => {
    assert.deepEqual(at(placeBlock(good, 'health', { col: 1, row: 6, colSpan: 4, rowSpan: 3 }), 'health'), { block: 'health', col: 1, row: 6, colSpan: 4, rowSpan: 3 });
    assert.deepEqual(at(placeBlock(good, 'health', { col: 1, row: 3, colSpan: 4, rowSpan: 6 }), 'health')?.rowSpan, 6);
    assert.ok('error' in placeBlock(good, 'health', { col: 3, row: 3, colSpan: 4, rowSpan: 3 }), 'onto core');
    assert.ok('error' in placeBlock(good, 'health', { col: 10, row: 3, colSpan: 4, rowSpan: 3 }), 'off the grid');
    assert.ok('error' in placeBlock(good, 'nope', { col: 1, row: 1, colSpan: 1, rowSpan: 1 }));
    assert.equal(good.items[2].row, 3, 'the original is untouched');
});

test('nudgeBlock: one step at a time', () => {
    assert.deepEqual(at(nudgeBlock(good, 'health', { row: 1 }), 'health')?.row, 4);
    assert.deepEqual(at(nudgeBlock(good, 'health', { rowSpan: 2 }), 'health')?.rowSpan, 5);
    assert.ok('error' in nudgeBlock(good, 'health', { col: 1 }), 'core is in the way');
    assert.ok('error' in nudgeBlock(good, 'header', { row: -1 }), 'top edge');
});

test('addBlock: the first free space, 4×3 if there is room', () => {
    const r = addBlock(removeBlock(good, 'core'), 'core');
    assert.deepEqual(at(r, 'core'), { block: 'core', col: 5, row: 3, colSpan: 4, rowSpan: 3 });
    assert.ok('error' in addBlock(good, 'core'), 'already there');
});

test('panel tabs: default all four, can be chosen, must be valid', () => {
    assert.deepEqual(panelTabsOf(good), ['actions', 'spells', 'gear', 'features']);
    const r = setPanelTabs(good, ['spells', 'actions'], BLOCKS);
    assert.ok('layout' in r && panelTabsOf(r.layout).join() === 'spells,actions');
    assert.ok('error' in setPanelTabs(good, [], BLOCKS));
    assert.ok('error' in checkLayout({ ...good, panelTabs: ['magic'] }, BLOCKS));
});

test('readingOrder and hiddenBlocks', () => {
    assert.deepEqual(readingOrder(good.items).map((i) => i.block), ['header', 'main', 'health', 'core']);
    assert.deepEqual(hiddenBlocks({ ...good, items: good.items.slice(0, 2) }, BLOCKS), ['health', 'core']);
});

test('every sheet has a header and the roll feed', () => {
    for (const kind of ['character', 'monster'] as const) {
        assert.ok(SHEET_BLOCKS[kind].includes('header') && SHEET_BLOCKS[kind].includes('rollFeed'));
    }
});

test('the DM page has its own blocks, with no repeats', () => {
    const dm = SHEET_BLOCKS.dm;
    for (const block of ['initiative', 'tableRolls', 'party', 'encounter', 'dmNotes', 'monHeader', 'pcHeader']) assert.ok(dm.includes(block));
    assert.equal(new Set(dm).size, dm.length);
    assert.ok(dm.length <= MAX_ITEMS);
});
