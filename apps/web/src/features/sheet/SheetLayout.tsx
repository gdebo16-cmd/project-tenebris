// Draws a sheet from its layout and lets the player rearrange it.
// Wide screen: a 12 × 16 grid that fills the screen (no page scrolling). Each block fills its cells; what doesn't fit
// scrolls inside the block. Phone: the same blocks in reading order, each as tall as its rows (keeping the grid's
// proportions), grouped under Stats / Combat / Condition on sheets with phone tabs; the page scrolls.
// Content smaller than its block is scaled up to fill it (Fit below); scrollbars are hidden (content still scrolls).
// Editing (wide screens, started from the sidebar): the cells show, drag a block to move it, drag its corner to resize it;
// or use the keyboard.
import { Fragment, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { GRID, nudgeBlock, placeBlock, readingOrder, removeBlock, type LayoutItem, type SheetLayout as Layout } from '@tenebris/rules/layout';
import shared from './Sheet.module.css';
import css from './SheetLayout.module.css';
import { PHONE_TABS, blockDef, blocksFor, isBlockId, type BlockId, type PhoneTab } from './blocks/registry.tsx';
import { useSheetTools } from './blocks/SheetContext.tsx';
import { DEFAULT_LAYOUTS, PHONE_TABS_ON, useSheetLayout } from './layouts.ts';
import { LayoutEditor } from './LayoutEditor.tsx';
import { EDIT_LAYOUT_EVENT, isWideScreen } from './layoutEvents.ts';

type Spot = { col: number; row: number; colSpan: number; rowSpan: number };
type Drag = { block: BlockId; mode: 'move' | 'resize'; start: { col: number; row: number }; orig: Spot; to: Spot; ok: boolean };
type Result = { error: string } | { layout: Layout };

const place = (s: Spot) => ({ '--col': `${s.col} / span ${s.colSpan}`, '--row': `${s.row} / span ${s.rowSpan}`, '--row-span': s.rowSpan }) as CSSProperties;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

// Scales a block's content up to fill its box when the content is smaller than the box (never down: what doesn't fit
// scrolls). Uses CSS zoom, so the content reflows at the larger size instead of being stretched. Re-fits when the box
// changes size (window, layout) or the content changes (a roll, a new item).
const MAX_ZOOM = 1.6;

function Fit({ children }: { children: ReactNode }) {
    const ref = useRef<HTMLDivElement>(null);
    useLayoutEffect(() => {
        const el = ref.current;
        const box = el?.parentElement;
        if (!el || !box) return;
        let frame = 0;
        const fit = () => {
            const room = box.clientHeight;
            if (!room) return;
            el.style.zoom = '1';
            el.style.minHeight = '0px';
            let zoom = 1;
            if (el.getBoundingClientRect().height < room - 1) {
                // The largest zoom at which the content still fits (a few halving steps are plenty)
                let lo = 1, hi = MAX_ZOOM;
                for (let i = 0; i < 7; i++) {
                    const mid = (lo + hi) / 2;
                    el.style.zoom = String(mid);
                    if (el.getBoundingClientRect().height <= room) lo = mid; else hi = mid;
                }
                zoom = lo;
            }
            el.style.zoom = String(zoom);
            el.style.minHeight = `${room / zoom}px`;   // the block's own box still fills the whole cell area
        };
        const later = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(fit); };
        fit();
        const resized = new ResizeObserver(later);
        resized.observe(box);
        const changed = new MutationObserver(later);
        changed.observe(el, { childList: true, subtree: true, characterData: true });
        return () => { resized.disconnect(); changed.disconnect(); cancelAnimationFrame(frame); };
    }, []);
    return <div ref={ref} className={css.fit}>{children}</div>;
}

export default function SheetLayout() {
    const tools = useSheetTools();
    const { layout: saved, save, saving } = useSheetLayout(tools.kind);
    const [draft, setDraft] = useState<Layout | null>(null);   // the layout being edited; null = not editing
    const [message, setMessage] = useState('');
    const [phoneTab, setPhoneTab] = useState<PhoneTab>('stats');
    const [drag, setDrag] = useState<Drag | null>(null);
    const gridRef = useRef<HTMLDivElement>(null);
    const editing = draft !== null;
    const layout = draft ?? saved;
    const blocks = blocksFor(tools.kind);
    const tabsOn = PHONE_TABS_ON[tools.kind] && !editing;

    // The sidebar's "Edit sheet layout" (layoutEvents.ts). Only on a wide screen, where the grid is shown.
    const savedRef = useRef(saved);
    useEffect(() => { savedRef.current = saved; }, [saved]);
    useEffect(() => {
        const start = () => { if (isWideScreen()) { setDraft(savedRef.current); setMessage(''); } };
        window.addEventListener(EDIT_LAYOUT_EVENT, start);
        return () => window.removeEventListener(EDIT_LAYOUT_EVENT, start);
    }, []);

    const change = (r: Result) => {
        if ('error' in r) setMessage(r.error);
        else { setDraft(r.layout); setMessage(''); }
    };
    const saveDraft = async () => {
        if (!draft) return;
        // Reset to default and saved unchanged: forget the player's layout, so future defaults reach them too
        const error = await save(draft === DEFAULT_LAYOUTS[tools.kind] ? null : draft);
        if (error) setMessage(error);
        else setDraft(null);
    };

    // ---- Dragging: the pointer's cell on the grid ----
    const cellAt = (x: number, y: number) => {
        const r = gridRef.current!.getBoundingClientRect();
        return {
            col: clamp(Math.floor(((x - r.left) / r.width) * GRID.columns) + 1, 1, GRID.columns),
            row: clamp(Math.floor(((y - r.top) / r.height) * GRID.rows) + 1, 1, GRID.rows),
        };
    };
    const startDrag = (e: PointerEvent<HTMLElement>, item: LayoutItem, mode: Drag['mode']) => {
        if (!draft || e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        const spot = { col: item.col, row: item.row, colSpan: item.colSpan, rowSpan: item.rowSpan };
        setDrag({ block: item.block as BlockId, mode, start: cellAt(e.clientX, e.clientY), orig: spot, to: spot, ok: true });
    };
    const moveDrag = (e: PointerEvent<HTMLElement>) => {
        if (!drag || !draft) return;
        const at = cellAt(e.clientX, e.clientY);
        const o = drag.orig;
        const to = drag.mode === 'move'
            ? {
                ...o,
                col: clamp(o.col + at.col - drag.start.col, 1, GRID.columns - o.colSpan + 1),
                row: clamp(o.row + at.row - drag.start.row, 1, GRID.rows - o.rowSpan + 1),
            }
            : { ...o, colSpan: Math.max(1, at.col - o.col + 1), rowSpan: Math.max(1, at.row - o.row + 1) };
        if (to.col !== drag.to.col || to.row !== drag.to.row || to.colSpan !== drag.to.colSpan || to.rowSpan !== drag.to.rowSpan) {
            setDrag({ ...drag, to, ok: 'layout' in placeBlock(draft, drag.block, to) });
        }
    };
    const endDrag = () => {
        if (!drag || !draft) return;
        const moved = drag.to.col !== drag.orig.col || drag.to.row !== drag.orig.row || drag.to.colSpan !== drag.orig.colSpan || drag.to.rowSpan !== drag.orig.rowSpan;
        if (moved) change(placeBlock(draft, drag.block, drag.to));
        setDrag(null);
    };

    // ---- Keyboard: arrows move, Shift + arrows resize, Delete hides ----
    const onKey = (e: KeyboardEvent<HTMLElement>, block: BlockId) => {
        if (!draft) return;
        const step: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
        if (step[e.key]) {
            e.preventDefault();
            const [x, y] = step[e.key];
            change(nudgeBlock(draft, block, e.shiftKey ? { colSpan: x, rowSpan: y } : { col: x, row: y }));
        } else if (e.key === 'Delete' || e.key === 'Backspace') {
            e.preventDefault();
            change({ layout: removeBlock(draft, block) });
        }
    };

    // The blocks to draw, in reading order. While editing, blocks shown only to some people (the roll feed) still show.
    const items = readingOrder(layout.items).flatMap((item) => {
        if (!isBlockId(item.block)) return [];
        const def = blockDef(item.block);
        if (!def.sheets.includes(tools.kind)) return [];
        const visible = !def.show || def.show(tools);
        return visible || editing ? [{ item, id: item.block, def, visible }] : [];
    });
    // On a phone the tab bar goes after the blocks that lead the page without a tab (the header)
    const lead = items.findIndex(({ def }) => def.phoneTab !== null);
    const tabBarAt = lead === -1 ? items.length : lead;
    const tabBar = tabsOn && (
        <nav className={css.phoneTabs} aria-label="Sheet areas">
            {PHONE_TABS.map((t) => (
                <button key={t.id} type="button" className={phoneTab === t.id ? shared.tabActive : shared.tab}
                    aria-pressed={phoneTab === t.id} onClick={() => setPhoneTab(t.id)}>{t.label}</button>
            ))}
        </nav>
    );

    return (
        <div className={css.root}>
            {editing && (
                <LayoutEditor layout={layout} blocks={blocks} onChange={change} onSave={saveDraft} saving={saving} message={message}
                    onCancel={() => { setDraft(null); setMessage(''); }}
                    onReset={() => { setDraft(DEFAULT_LAYOUTS[tools.kind]); setMessage(''); }} />
            )}

            <div ref={gridRef} className={editing ? `${css.grid} ${css.gridEditing}` : css.grid}>
                {/* The cells, so the grid shows while arranging */}
                {editing && Array.from({ length: GRID.columns * GRID.rows }, (_, i) => (
                    <div key={`cell${i}`} className={css.cell} style={place({ col: (i % GRID.columns) + 1, row: Math.floor(i / GRID.columns) + 1, colSpan: 1, rowSpan: 1 })} aria-hidden="true" />
                ))}

                {items.map(({ item, id, def, visible }, i) => {
                    const hiddenOnPhone = tabsOn && def.phoneTab !== null && def.phoneTab !== phoneTab;
                    const Block = def.Component;
                    if (!editing) {
                        return (
                            <Fragment key={id}>
                                {i === tabBarAt && tabBar}
                                <div className={hiddenOnPhone ? css.itemPhoneHidden : css.item} style={place(item)} data-block={id}>
                                    <Fit><Block layout={layout} /></Fit>
                                </div>
                            </Fragment>
                        );
                    }
                    const dragging = drag?.block === id;
                    return (
                        <div key={id} className={dragging ? `${css.itemEditing} ${css.itemDragging}` : css.itemEditing} style={place(item)} data-block={id}
                            tabIndex={0} role="group" onKeyDown={(e) => onKey(e, id)}
                            aria-label={`${def.label}. Drag or use the arrow keys to move it, Shift and arrows to resize it, Delete to hide it.`}>
                            <div className={css.handle} onPointerDown={(e) => startDrag(e, item, 'move')} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={() => setDrag(null)}>
                                <span className={css.handleName}>{def.label}</span>
                                <span className={css.handleSize}>{item.colSpan}×{item.rowSpan}</span>
                                <button type="button" className={css.hide} aria-label={`Hide ${def.label}`} title="Hide"
                                    onPointerDown={(e) => e.stopPropagation()} onClick={() => change({ layout: removeBlock(layout, id) })}>×</button>
                            </div>
                            {/* A preview: nothing inside can be clicked while arranging */}
                            <div className={css.preview} inert>
                                <Fit>{visible ? <Block layout={layout} /> : <p className={shared.muted}>{def.label}: {def.note}</p>}</Fit>
                            </div>
                            <div className={css.resize} aria-hidden="true" title="Drag to resize"
                                onPointerDown={(e) => startDrag(e, item, 'resize')} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={() => setDrag(null)} />
                        </div>
                    );
                })}
                {!editing && tabBarAt === items.length && tabBar}

                {/* Where the block will land: green if it fits, red if something's in the way */}
                {drag && <div className={drag.ok ? css.ghost : css.ghostBlocked} style={place(drag.to)} aria-hidden="true" />}
            </div>
        </div>
    );
}
