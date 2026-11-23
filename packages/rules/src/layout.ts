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
export function checkLayout(raw: unknown, knownBlocks: readonly string[]): Result {
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
    const items: LayoutItem[] = [];
    for (const raw of l.items) {
        const it = (raw ?? {}) as Record<string, unknown>;
        if (typeof it.block !== 'string') return { error: 'every item needs a block' };
        if (!known.has(it.block)) continue;
        if (items.some((i) => i.block === it.block)) return { error: `${it.block} is in the layout twice` };
        const item = { block: it.block, col: it.col, row: it.row, colSpan: it.colSpan, rowSpan: it.rowSpan } as LayoutItem;
        const why = outside(item);
        if (why) return { error: why };
        const hit = items.find((o) => overlap(o, item));
        if (hit) return { error: `${item.block} overlaps ${hit.block}` };
        items.push(item);
    }
    return { layout: panelTabs ? { version: 2, items, panelTabs } : { version: 2, items } };
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
export function setPanelTabs(layout: SheetLayout, tabs: PanelTab[], blocks: readonly string[]): Result {
    return checkLayout({ ...copy(layout), panelTabs: [...tabs] }, blocks);
}
