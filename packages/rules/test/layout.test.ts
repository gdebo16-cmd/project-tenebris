import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    GRID, MAX_ITEMS, SHEET_BLOCKS, addBlock, addToStack, checkLayout, hiddenBlocks, layoutKey, moveInStack, nudgeBlock, panelTabsOf, parseLayoutKey, phoneStack,
    placeBlock, readingOrder, removeBlock, setBlockTab, setPanelTabs, setStackHeight,
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

test('mobile layouts are saved under their own key, the desktop one keeps the kind name', () => {
    assert.equal(layoutKey('character', 'desktop'), 'character');
    assert.equal(layoutKey('character', 'mobile'), 'character-mobile');
    assert.deepEqual(parseLayoutKey('character'), { kind: 'character', device: 'desktop' });
    assert.deepEqual(parseLayoutKey('dm-mobile'), { kind: 'dm', device: 'mobile' });
    assert.equal(parseLayoutKey('bogus-mobile'), null);
    assert.equal(parseLayoutKey('character-tablet'), null);
});

test('phoneStack stacks a desktop layout in reading order, keeping heights', () => {
    const s = phoneStack(good);
    assert.deepEqual(s.items.map((i) => i.block), ['header', 'main', 'health', 'core']);
    assert.deepEqual(s.items.map((i) => [i.col, i.colSpan, i.row, i.rowSpan]), [[1, 12, 1, 2], [1, 12, 2, 16], [1, 12, 3, 3], [1, 12, 4, 3]]);
});

test('a mobile layout is checked as a stack: tall blocks need no free grid space', () => {
    const tall = { version: 2, items: ['header', 'health', 'core', 'main'].map((block, i) => ({ block, col: 1, row: i + 1, colSpan: 12, rowSpan: 16 })) };
    assert.ok('layout' in checkLayout(tall, BLOCKS, 'mobile'));
    assert.ok('error' in checkLayout(tall, BLOCKS));   // the desktop grid refuses it (overlaps)
    assert.ok('error' in checkLayout({ version: 2, items: [{ block: 'header', col: 1, row: 1, colSpan: 12, rowSpan: 17 }] }, BLOCKS, 'mobile'));
    const loose = checkLayout({ version: 2, items: [{ block: 'core', col: 5, row: 9, colSpan: 2, rowSpan: 4 }, { block: 'header', col: 3, row: 2, colSpan: 1, rowSpan: 2 }] }, BLOCKS, 'mobile');
    assert.ok('layout' in loose);
    if ('layout' in loose) assert.deepEqual(loose.layout.items.map((i) => [i.block, i.col, i.colSpan, i.row]), [['header', 1, 12, 1], ['core', 1, 12, 2]]);
});

test('moving, resizing and adding blocks in the stack', () => {
    const s = phoneStack(good);
    assert.deepEqual(moveInStack(s, 'health', -1).items.map((i) => i.block), ['header', 'health', 'main', 'core']);
    assert.deepEqual(moveInStack(s, 'header', -1).items.map((i) => i.block), ['header', 'main', 'health', 'core']);
    assert.deepEqual(moveInStack(s, 'core', 1).items.map((i) => i.block), ['header', 'main', 'health', 'core']);
    assert.equal(setStackHeight(s, 'core', 5).items.find((i) => i.block === 'core')?.rowSpan, 5);
    assert.equal(setStackHeight(s, 'core', 99).items.find((i) => i.block === 'core')?.rowSpan, GRID.rows);
    assert.equal(setStackHeight(s, 'core', 0).items.find((i) => i.block === 'core')?.rowSpan, 1);
    const smaller = removeBlock(s, 'core');
    const back = addToStack(smaller, 'core');
    assert.ok('layout' in back && back.layout.items.at(-1)?.block === 'core');
    assert.ok('error' in addToStack(s, 'core'));
});

test('a block can be assigned to any tab; a missing tab stays the default; an unknown tab is dropped', () => {
    const withTab = { ...good, items: good.items.map((i, n) => (n === 0 ? { ...i, tab: 'combat' as const } : i)) };
    const r = checkLayout(withTab, BLOCKS, 'desktop', 'character');
    assert.ok('layout' in r);
    if ('layout' in r) {
        assert.equal(r.layout.items.find((i) => i.block === 'header')?.tab, 'combat');
        assert.equal('tab' in (r.layout.items.find((i) => i.block === 'health') ?? {}), false);
    }
    const always = checkLayout({ ...good, items: [{ ...good.items[0], tab: null }, ...good.items.slice(1)] }, BLOCKS, 'desktop', 'character');
    assert.ok('layout' in always && always.layout.items[0].tab === null);
    const dropped = checkLayout({ ...good, items: [{ ...good.items[0], tab: 'turns' }, ...good.items.slice(1)] }, BLOCKS, 'desktop', 'character');
    assert.ok('layout' in dropped);
    if ('layout' in dropped) assert.equal('tab' in dropped.layout.items[0], false);
});

test('setBlockTab moves a block to a tab or the main area, and phoneStack keeps the assignment', () => {
    const moved = setBlockTab(good, 'health', 'stats', 'character');
    assert.ok('layout' in moved && moved.layout.items.find((i) => i.block === 'health')?.tab === 'stats');
    const main = setBlockTab(good, 'health', null, 'character');
    assert.ok('layout' in main && main.layout.items.find((i) => i.block === 'health')?.tab === null);
    assert.ok('error' in setBlockTab(good, 'health', 'turns', 'character'));
    assert.ok('error' in setBlockTab(good, 'missing', 'stats', 'character'));
    const stacked = phoneStack('layout' in moved ? moved.layout : good);
    assert.equal(stacked.items.find((i) => i.block === 'health')?.tab, 'stats');
});