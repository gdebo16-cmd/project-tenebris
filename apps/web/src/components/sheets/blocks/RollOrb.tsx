// The floating orb that shows your last roll. Drag it anywhere; tap it to open or close.
// "open" and "rolls" come from CharacterSheetPage, so any roll on the sheet can pop it open.
// Touch (phones) and mouse (computers) are handled separately, because iPhone Safari
// is unreliable with pointer events on a fixed element.
// Position is kept in CSS custom properties (no React style=).
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { FeedEntry } from './RollFeed.tsx';
import styles from '../../../styles/components/sheets/blocks/RollOrb.module.css';

type Position = { left: number; top: number };
type Flip = { left: boolean; up: boolean };
type Props = { open: boolean; onToggle: () => void; rolls?: FeedEntry[] };

const closedSize = () => (window.innerWidth <= 768 ? 48 : 64);

function orbStateClass(open: boolean, dragging: boolean, flip: Flip): string {
    if (!open) return dragging ? styles.orbClosedDragging : styles.orbClosed;
    if (flip.left && flip.up) return styles.orbOpenLeftUp;
    if (flip.left) return styles.orbOpenLeft;
    if (flip.up) return styles.orbOpenUp;
    return styles.orbOpen;
}

export default function RollOrb({ open, onToggle, rolls = [] }: Props) {
    const [position, setPosition] = useState<Position | null>(null);
    const [dragging, setDragging] = useState(false);
    const orbRef = useRef<HTMLDivElement>(null);
    const drag = useRef<{ startX: number; startY: number; left: number; top: number; moved: boolean } | null>(null);
    const toggleRef = useRef(onToggle);
    useEffect(() => { toggleRef.current = onToggle; }, [onToggle]);
    const [flip, setFlip] = useState<Flip>({ left: false, up: false });
    const feedRef = useRef<HTMLUListElement>(null);
    const atBottom = useRef(true);
    const [showJump, setShowJump] = useState(false);
    const feedScrolled = useRef(false);
    const chronological = [...rolls].reverse();

    const scrollToBottom = () => {
        const el = feedRef.current;
        if (el) el.scrollTop = el.scrollHeight;
        atBottom.current = true;
        setShowJump(false);
    };

    useEffect(() => { if (open) requestAnimationFrame(() => scrollToBottom()); }, [open]);

    useEffect(() => {
        if (!open || rolls.length === 0) return;
        requestAnimationFrame(() => {
            if (atBottom.current) scrollToBottom();
            else setShowJump(true);
        });
    }, [rolls, open]);

    const onFeedScroll = () => {
        const el = feedRef.current;
        if (!el) return;
        feedScrolled.current = true;
        atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 8;
        if (atBottom.current) setShowJump(false);
    };

    useEffect(() => {
        if (!open || !orbRef.current) return;
        const rect = orbRef.current.getBoundingClientRect();
        const centerX = rect.left + closedSize() / 2;
        const centerY = rect.top + closedSize() / 2;
        setFlip({ left: centerX > window.innerWidth / 2, up: centerY > window.innerHeight / 2 });
    }, [open, position]);

    const clamp = (left: number, top: number): Position => {
        const size = closedSize();
        return {
            left: Math.min(Math.max(0, left), window.innerWidth - size),
            top: Math.min(Math.max(0, top), window.innerHeight - size),
        };
    };

    useEffect(() => {
        const onResize = () => setPosition((p) => (p ? clamp(p.left, p.top) : p));
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    useLayoutEffect(() => {
        const el = orbRef.current;
        if (!el) return;
        if (position) {
            el.style.setProperty('--orb-left', `${position.left}px`);
            el.style.setProperty('--orb-top', `${position.top}px`);
            el.style.setProperty('--orb-right', 'auto');
        } else {
            el.style.removeProperty('--orb-left');
            el.style.removeProperty('--orb-top');
            el.style.removeProperty('--orb-right');
        }
    }, [position]);

    const start = (x: number, y: number) => {
        const el = orbRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        drag.current = { startX: x, startY: y, left: rect.left, top: rect.top, moved: false };
        setDragging(true);
    };
    const move = (x: number, y: number) => {
        if (!drag.current) return;
        const dx = x - drag.current.startX;
        const dy = y - drag.current.startY;
        if (Math.abs(dx) > 10 || Math.abs(dy) > 10) drag.current.moved = true;
        if (!drag.current.moved) return;
        setPosition(clamp(drag.current.left + dx, drag.current.top + dy));
    };
    const end = () => {
        if (!drag.current) return;
        const wasDrag = drag.current.moved;
        drag.current = null;
        setDragging(false);
        if (!wasDrag) toggleRef.current();
    };

    const inFeed = (target: EventTarget | null) =>
        target instanceof Element && !!target.closest('[data-roll-feed], [data-roll-jump]');

    useEffect(() => {
        const el = orbRef.current;
        if (!el) return;
        const onTouchStart = (e: TouchEvent) => { if (inFeed(e.target)) return; e.preventDefault(); const t = e.touches[0]; start(t.clientX, t.clientY); };
        const onTouchMove = (e: TouchEvent) => { if (inFeed(e.target)) return; e.preventDefault(); const t = e.touches[0]; move(t.clientX, t.clientY); };
        const onTouchEnd = (e: TouchEvent) => { if (inFeed(e.target)) return; e.preventDefault(); end(); };
        const onTouchCancel = () => { if (drag.current) { drag.current = null; setDragging(false); } };
        el.addEventListener('touchstart', onTouchStart, { passive: false });
        el.addEventListener('touchmove', onTouchMove, { passive: false });
        el.addEventListener('touchend', onTouchEnd, { passive: false });
        el.addEventListener('touchcancel', onTouchCancel);
        return () => {
            el.removeEventListener('touchstart', onTouchStart);
            el.removeEventListener('touchmove', onTouchMove);
            el.removeEventListener('touchend', onTouchEnd);
            el.removeEventListener('touchcancel', onTouchCancel);
        };
    }, []);

    const onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.button !== 0 || inFeed(e.target)) return;
        start(e.clientX, e.clientY);
        const onMove = (ev: MouseEvent) => move(ev.clientX, ev.clientY);
        const onUp = () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
            end();
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    };

    return (
        <div
            ref={orbRef}
            className={`${styles.orb} ${orbStateClass(open, dragging, flip)}`}
            role="button"
            tabIndex={0}
            aria-expanded={open}
            aria-label="Open Roll Panel"
            onMouseDown={onMouseDown}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } }}
        >
            <div className={open ? styles.orbFaceHidden : styles.orbFace} aria-hidden="true"></div>
            <div className={styles.orbPanel} hidden={!open}>
                <ul className={styles.feed} ref={feedRef} data-roll-feed onScroll={onFeedScroll}
                    onPointerDown={() => { feedScrolled.current = false; }}
                    onClick={() => { if (!feedScrolled.current) onToggle(); }}>
                    {chronological.map((r) => (
                        <li key={r.id} className={r.mine ? styles.bubbleSent : styles.bubbleReceived}>
                            {!r.mine && <span className={styles.bubbleName}>{r.who}</span>}
                            {r.text}
                        </li>
                    ))}
                </ul>
                {showJump && (
                    <button type="button" className={styles.jump} data-roll-jump aria-label="Jump to newest roll" onClick={scrollToBottom}>{'\u2193'}</button>
                )}
            </div>
        </div>
    );
}
