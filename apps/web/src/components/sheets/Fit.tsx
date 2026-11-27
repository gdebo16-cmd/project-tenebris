// Scales a block's content to fill its box: up when the content is smaller, down when it's bigger, so the block's
// content grows and shrinks with the block. Uses CSS zoom, so the content reflows at the new size instead of being
// stretched. Re-fits when the box changes size (window, layout, resizing in the editor) or the content changes.
// Blocks marked `scrolls` (growing lists: actions, spells...) only scale up; what doesn't fit scrolls out of sight.
// Blocks marked `fills` (grids of tiles: stats, skills...) aren't zoomed at all: their tiles stretch to fill the block
// in both directions and their text sizes itself to each tile (container units in the block's CSS). Zoom keeps the
// content's shape, so in a tall, narrow block it could only ever fill the width; stretching fills both.
// So do all blocks on a phone, where text shrunk to fit would be too small to read. Below MIN_ZOOM, a block scrolls too.
// "Fits" means two things: the content is no taller than the box, and nothing inside spills sideways
// (a stat label wider than its tile, a row of buttons wider than the block). A tall, narrow block stops growing
// as soon as its widest piece reaches the edge.
import { useLayoutEffect, useRef, type ReactNode } from 'react';
import css from '../../styles/components/sheets/SheetLayout.module.css';
import { isWideScreen } from '../../features/sheets/layoutEvents.ts';

const MAX_ZOOM = 1.6;
const MIN_ZOOM = 0.5;

// Pictures and form fields hold nothing that could spill (and images report odd widths), so they're skipped
const NO_CONTENT = new Set(['IMG', 'INPUT', 'SELECT', 'TEXTAREA', 'VIDEO', 'CANVAS']);

function spillsSideways(el: HTMLElement) {
    if (el.scrollWidth > el.clientWidth + 1) return true;
    for (const node of el.querySelectorAll<HTMLElement>('*')) {
        if (NO_CONTENT.has(node.tagName)) continue;
        if (node.clientWidth > 0 && node.scrollWidth > node.clientWidth + 1) return true;
    }
    return false;
}

export type Scaling = 'both' | 'up' | 'none';
export const scalingOf = (def: { scrolls?: true; fills?: true }): Scaling => (def.fills ? 'none' : def.scrolls ? 'up' : 'both');

export function Fit({ children, scaling }: { children: ReactNode; scaling: Scaling }) {
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
            const fits = () => el.getBoundingClientRect().height <= room && !spillsSideways(el);
            let zoom = 1;
            if (scaling === 'none') {
                // the block stretches itself to fill (see above): just give it the whole cell area
            } else if (el.getBoundingClientRect().height < room - 1 && fits()) {
                // The largest zoom at which the content still fits (a few halving steps are plenty)
                let lo = 1, hi = MAX_ZOOM;
                for (let i = 0; i < 7; i++) {
                    const mid = (lo + hi) / 2;
                    el.style.zoom = String(mid);
                    if (fits()) lo = mid; else hi = mid;
                }
                zoom = lo;
            } else if (scaling === 'both' && isWideScreen() && !fits()) {
                // Too big at full size: the largest zoom, down to MIN_ZOOM, at which it fits
                // (still too big at MIN_ZOOM? it stays there and the rest scrolls)
                let lo = MIN_ZOOM, hi = 1;
                for (let i = 0; i < 7; i++) {
                    const mid = (lo + hi) / 2;
                    el.style.zoom = String(mid);
                    if (fits()) lo = mid; else hi = mid;
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
    }, [scaling]);
    return <div ref={ref} className={css.fit}>{children}</div>;
}
