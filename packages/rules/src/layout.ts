// Sheet layouts as data. A layout places blocks on a fixed grid: 12 columns × 16 rows of equal cells.
// On a wide screen the grid fills the screen (no page scrolling); a block fills exactly its cells and its content
// scrolls inside it when it doesn't fit. On a phone the blocks stack in reading order, keeping their proportions.
// Pure functions: the browser uses them to draw and edit, the server uses checkLayout before saving (L4).

export const GRID = { columns: 12, rows: 16 } as const;

export type LayoutItem = {
    block: string;     // a block id (SHEET_BLOCKS below)
    col: number;       // first column, 1-based
    row: number;       // first row, 1-based
    colSpan: number;   // columns it covers
    rowSpan: number;   // rows it covers
    tab?: string | null; // the phone-area tab this block sits in. Missing = the block's default; null = always shown (the main area); a string = that tab.
};

export type SheetLayout = {
    version: 2;
    items: LayoutItem[];
    panelTabs?: PanelTab[];   // the action panel's tabs, in order (L6). Missing = all four.
};

// The kinds of sheet, and the blocks each one can place (the web app's block list must match: registry.tsx)
export const SHEET_KINDS = ['character', 'monster', 'dm'] as const;
export type SheetKind = (typeof SHEET_KINDS)[number];
export const SHEET_BLOCKS: Record<SheetKind, readonly string[]> = {
    character: ['header', 'health', 'core', 'stats', 'skills', 'conditions', 'rest', 'actionPanel', 'actions', 'spells', 'gear', 'features', 'rollFeed'],
    monster: ['header', 'health', 'core', 'stats', 'skills', 'conditions', 'actions', 'legendary', 'features', 'traits', 'rollFeed'],
    // The DM page: its own blocks, then the current monster's and the current player's sheet blocks
    dm: ['initiative', 'tableRolls', 'party', 'encounter', 'dmNotes',
        'monHeader', 'monHealth', 'monCore', 'monStats', 'monSkills', 'monConditions', 'monActions', 'monLegendary', 'monFeatures', 'monTraits',
        'pcHeader', 'pcHealth', 'pcCore', 'pcStats', 'pcSkills', 'pcConditions', 'pcActions', 'pcSpells', 'pcGear', 'pcFeatures'],
};
export const isSheetKind = (v: unknown): v is SheetKind => SHEET_KINDS.includes(v as SheetKind);

// The phone-area tabs of each kind of sheet (Stats / Combat / Condition, and the DM's own). A layout can put any
// of its blocks in any of these, or in the main area (always shown). The web app has the labels.
export const SHEET_TABS = {
    character: ['stats', 'combat', 'condition'],
    monster: ['stats', 'combat', 'condition'],
    dm: ['turns', 'party', 'encounter', 'notes'],
} as const satisfies Record<SheetKind, readonly string[]>;
export type SheetTab = (typeof SHEET_TABS)[SheetKind][number];
const ALL_SHEET_TABS: readonly string[] = [...SHEET_TABS.character, ...SHEET_TABS.dm];
const tabsOf = (knownBlocks: readonly string[], kind?: SheetKind): readonly string[] => {
    if (kind) return SHEET_TABS[kind];
    const inferred = SHEET_KINDS.find((k) => knownBlocks.length === SHEET_BLOCKS[k].length && knownBlocks.every((b) => SHEET_BLOCKS[k].includes(b)));
    return inferred ? SHEET_TABS[inferred] : ALL_SHEET_TABS;
};
// Keep a tab assignment if it's valid; drop an unknown one (the block then uses its default). Missing stays missing.
const withTab = (item: LayoutItem, raw: Record<string, unknown>, tabs: readonly string[]): LayoutItem => {
    if (!Object.prototype.hasOwnProperty.call(raw, 'tab')) return item;
    if (raw.tab === null) return { ...item, tab: null };
    if (typeof raw.tab === 'string' && tabs.includes(raw.tab)) return { ...item, tab: raw.tab };
    return item;
};

// Each sheet can have two saved layouts: the desktop one (the 12 × 16 grid, wide screens) and a separate mobile one
// (phone screens: a single column of blocks, each as tall as its rows). The mobile layout is stored with the same
// shape, but its items are stacked: column 1, 12 wide, one after another in `row` order (checkLayout and phoneStack).
// Until a mobile layout is saved, the phone follows the desktop layout's reading order (phoneStack of it).
export const LAYOUT_DEVICES = ['desktop', 'mobile'] as const;
export type LayoutDevice = (typeof LAYOUT_DEVICES)[number];

// Where a layout is saved: the desktop layout under the kind's own name (as it always was), the mobile one next to it
export const layoutKey = (kind: SheetKind, device: LayoutDevice): string => (device === 'mobile' ? `${kind}-mobile` : kind);
export function parseLayoutKey(key: string): { kind: SheetKind; device: LayoutDevice } | null {
    if (isSheetKind(key)) return { kind: key, device: 'desktop' };
    const m = /^(.+)-mobile$/.exec(key);
    return m && isSheetKind(m[1]) ? { kind: m[1], device: 'mobile' } : null;
}
// The action panel's tabs (L6)
export const PANEL_TABS = ['actions', 'spells', 'gear', 'features'] as const;
export type PanelTab = (typeof PANEL_TABS)[number];
export const panelTabsOf = (layout: SheetLayout): PanelTab[] => layout.panelTabs ?? [...PANEL_TABS];

export const MAX_ITEMS = 30;

type Result = { error: string } | { layout: SheetLayout };

const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
const overlap = (a: LayoutItem, b: LayoutItem) =>
    a.col < b.col + b.colSpan && b.col < a.col + a.colSpan && a.row < b.row + b.rowSpan && b.row < a.row + a.rowSpan;

// Inside the grid? Answers why not, or null.
function outside(it: LayoutItem): string | null {
    if (!isInt(it.col) || !isInt(it.row) || !isInt(it.colSpan) || !isInt(it.rowSpan)) return `${it.block} needs whole numbers`;
    if (it.colSpan < 1 || it.rowSpan < 1) return `${it.block} can't be smaller than one cell`;
    if (it.col < 1 || it.col + it.colSpan - 1 > GRID.columns) return `${it.block} doesn't fit in ${GRID.columns} columns`;
    if (it.row < 1 || it.row + it.rowSpan - 1 > GRID.rows) return `${it.block} doesn't fit in ${GRID.rows} rows`;
    return null;
}

// A layout from storage or from a request, checked. Answers the cleaned layout or an error.
// Unknown blocks are dropped (a block may have been removed from the app); everything else must be valid.
// Older layouts (version 1, with column widths) aren't valid any more: the sheet falls back to the default.
export function checkLayout(raw: unknown, knownBlocks: readonly string[], device: LayoutDevice = 'desktop', kind?: SheetKind): Result {
    const l = (raw ?? {}) as Record<string, unknown>;
    if (l.version !== 2) return { error: 'Unknown layout version' };
    if (!Array.isArray(l.items) || l.items.length > MAX_ITEMS) return { error: `items must be a list of at most ${MAX_ITEMS}` };
    let panelTabs: PanelTab[] | undefined;
    if (l.panelTabs !== undefined) {
        if (!Array.isArray(l.panelTabs) || l.panelTabs.length < 1) return { error: 'the action panel needs at least one tab' };
        if (l.panelTabs.some((t) => !PANEL_TABS.includes(t as PanelTab))) return { error: 'unknown action panel tab' };
        if (new Set(l.panelTabs).size !== l.panelTabs.length) return { error: 'an action panel tab is listed twice' };
        panelTabs = l.panelTabs as PanelTab[];
    }
    const known = new Set(knownBlocks);
    const tabs = tabsOf(knownBlocks, kind);
    const items: LayoutItem[] = [];
    for (const raw of l.items) {
        const it = (raw ?? {}) as Record<string, unknown>;
        if (typeof it.block !== 'string') return { error: 'every item needs a block' };
        if (!known.has(it.block)) continue;
        if (items.some((i) => i.block === it.block)) return { error: `${it.block} is in the layout twice` };
        if (device === 'mobile') {
            // A phone layout is a stack: only the order (row) and the height (rowSpan) matter; the rest is set here
            if (!isInt(it.row) || !isInt(it.rowSpan)) return { error: `${it.block} needs whole numbers` };
            if (it.rowSpan < 1 || it.rowSpan > GRID.rows) return { error: `${it.block} must be between 1 and ${GRID.rows} rows tall` };
            items.push(withTab({ block: it.block, col: 1, row: it.row, colSpan: GRID.columns, rowSpan: it.rowSpan }, it, tabs));
            continue;
        }
        const item = withTab({ block: it.block, col: it.col, row: it.row, colSpan: it.colSpan, rowSpan: it.rowSpan } as LayoutItem, it, tabs);
        const why = outside(item);
        if (why) return { error: why };
        const hit = items.find((o) => overlap(o, item));
        if (hit) return { error: `${item.block} overlaps ${hit.block}` };
        items.push(item);
    }
    const placed = device === 'mobile' ? stack(items) : items;
    return { layout: panelTabs ? { version: 2, items: placed, panelTabs } : { version: 2, items: placed } };
}

// Phone order: reading order, top row first, then left to right
export function readingOrder(items: LayoutItem[]): LayoutItem[] {
    return [...items].sort((a, b) => a.row - b.row || a.col - b.col);
}

// The blocks a layout leaves out (the editor's "hidden blocks")
export function hiddenBlocks(layout: SheetLayout, allBlocks: readonly string[]): string[] {
    const shown = new Set(layout.items.map((i) => i.block));
    return allBlocks.filter((b) => !shown.has(b));
}

// ---- Editing. Each answers the changed layout, or why it can't be done. The layout passed in is never changed. ----

const copy = (l: SheetLayout): SheetLayout => ({ ...l, items: l.items.map((i) => ({ ...i })), ...(l.panelTabs ? { panelTabs: [...l.panelTabs] } : {}) });

// Put a block at a spot and size (dragging, resizing, the keyboard). Refused if it leaves the grid or lands on another block.
export function placeBlock(layout: SheetLayout, block: string, spot: { col: number; row: number; colSpan: number; rowSpan: number }): Result {
    const next = copy(layout);
    const it = next.items.find((i) => i.block === block);
    if (!it) return { error: 'That block is not on the sheet' };
    const moved = { block, ...spot };
    const why = outside(moved);
    if (why) return { error: why };
    const hit = next.items.find((o) => o !== it && overlap(o, moved));
    if (hit) return { error: `${hit.block} is in the way` };
    Object.assign(it, spot);
    return { layout: next };
}

// One step with the keyboard: move (dCol, dRow) or resize (dColSpan, dRowSpan)
export function nudgeBlock(layout: SheetLayout, block: string, d: { col?: number; row?: number; colSpan?: number; rowSpan?: number }): Result {
    const it = layout.items.find((i) => i.block === block);
    if (!it) return { error: 'That block is not on the sheet' };
    return placeBlock(layout, block, {
        col: it.col + (d.col ?? 0), row: it.row + (d.row ?? 0),
        colSpan: it.colSpan + (d.colSpan ?? 0), rowSpan: it.rowSpan + (d.rowSpan ?? 0),
    });
}

// Take a block off the sheet (it goes to the hidden blocks)
export function removeBlock(layout: SheetLayout, block: string): SheetLayout {
    const next = copy(layout);
    next.items = next.items.filter((i) => i.block !== block);
    return next;
}

// Put a hidden block back in the first free space: 4×3 cells if there's room, else smaller
export function addBlock(layout: SheetLayout, block: string): Result {
    if (layout.items.some((i) => i.block === block)) return { error: 'That block is already on the sheet' };
    for (const [colSpan, rowSpan] of [[4, 3], [3, 2], [2, 2], [1, 1]]) {
        for (let row = 1; row + rowSpan - 1 <= GRID.rows; row++) {
            for (let col = 1; col + colSpan - 1 <= GRID.columns; col++) {
                const spot = { block, col, row, colSpan, rowSpan };
                if (!layout.items.some((o) => overlap(o, spot))) return { layout: { ...copy(layout), items: [...copy(layout).items, spot] } };
            }
        }
    }
    return { error: 'There is no free space: make room first' };
}

// Choose the action panel's tabs (L6), in the order given
export function setPanelTabs(layout: SheetLayout, tabs: PanelTab[], blocks: readonly string[], device: LayoutDevice = 'desktop', kind?: SheetKind): Result {
    return checkLayout({ ...copy(layout), panelTabs: [...tabs] }, blocks, device, kind);
}

// ---- The mobile layout: a stack of blocks, one under another ----

// Items stacked in reading order: column 1, full width, rows numbered 1, 2, 3 … (heights kept)
const stack = (items: LayoutItem[]): LayoutItem[] =>
    readingOrder(items).map((it, i) => ({ ...it, col: 1, row: i + 1, colSpan: GRID.columns }));

// A layout as the phone shows it: its blocks in reading order, each as tall as its rows. This is what the phone uses
// until it has a layout of its own, and what "Reset" goes back to.
export function phoneStack(layout: SheetLayout): SheetLayout {
    return { ...copy(layout), items: stack(layout.items) };
}

// Move a block one place up (-1) or down (1) the stack. At the end of the stack nothing changes.
export function moveInStack(layout: SheetLayout, block: string, dir: -1 | 1): SheetLayout {
    const order = readingOrder(layout.items);
    const from = order.findIndex((i) => i.block === block);
    const to = from + dir;
    if (from === -1 || to < 0 || to >= order.length) return phoneStack(layout);
    const moved = order.map((i) => ({ ...i }));
    [moved[from], moved[to]] = [moved[to], moved[from]];
    return { ...copy(layout), items: moved.map((it, i) => ({ ...it, col: 1, row: i + 1, colSpan: GRID.columns })) };
}

// Set how tall a block is on the phone, in grid rows (1 to GRID.rows)
export function setStackHeight(layout: SheetLayout, block: string, rowSpan: number): SheetLayout {
    const next = phoneStack(layout);
    const it = next.items.find((i) => i.block === block);
    if (it) it.rowSpan = Math.max(1, Math.min(GRID.rows, Math.round(rowSpan)));
    return next;
}

// Put a hidden block at the bottom of the stack
export function addToStack(layout: SheetLayout, block: string): Result {
    if (layout.items.some((i) => i.block === block)) return { error: 'That block is already on the sheet' };
    if (layout.items.length >= MAX_ITEMS) return { error: 'There is no room for more blocks' };
    const next = phoneStack(layout);
    next.items.push({ block, col: 1, row: next.items.length + 1, colSpan: GRID.columns, rowSpan: 3 });
    return { layout: next };
}

// Put a block in a phone-area tab, or in the main area (tab = null, always shown). The assignment is saved on the layout.
export function setBlockTab(layout: SheetLayout, block: string, tab: string | null, kind: SheetKind): Result {
    if (tab !== null && !(SHEET_TABS[kind] as readonly string[]).includes(tab)) return { error: 'unknown tab' };
    const next = copy(layout);
    const it = next.items.find((i) => i.block === block);
    if (!it) return { error: 'That block is not on the sheet' };
    it.tab = tab;
    return { layout: next };
}