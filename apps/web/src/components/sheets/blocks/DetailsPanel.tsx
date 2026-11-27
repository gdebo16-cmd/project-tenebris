// The details panel (back from the old sheet): one weapon, armor, item, spell or feature at a time.
// Slides in from the right on a wide screen and up from the bottom on a phone. × or Escape closes it.
// Rendered at the end of <body> (a portal) so no block's layout can squeeze or clip it.
import { Children, useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import panel from '../../../styles/components/sheets/blocks/DetailsPanel.module.css';

type Props = { title: string; onClose: () => void; children: ReactNode };

export default function DetailsPanel({ title, onClose, children }: Props) {
    const closeRef = useRef<HTMLButtonElement>(null);
    const closeNow = useRef(onClose);
    useEffect(() => { closeNow.current = onClose; }, [onClose]);

    // Escape closes the panel
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeNow.current(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    // Keyboard focus moves to × whenever something new opens
    useEffect(() => { closeRef.current?.focus(); }, [title]);

    return createPortal(
        <aside className={panel.panel} role="dialog" aria-label={title}>
            <button ref={closeRef} type="button" className={panel.close} aria-label="Close details" onClick={onClose}>×</button>
            <h3 className={panel.title}>{title}</h3>
            {children}
        </aside>,
        document.body,
    );
}

// A titled box of facts, like the old "Weapon Details" / "Incantation" boxes
export function DetailBox({ heading, children }: { heading: string; children: ReactNode }) {
    return (
        <section className={panel.box}>
            <h4 className={panel.boxTitle}>{heading}</h4>
            {children}
        </section>
    );
}

// One fact: "Range: 5 ft". Nothing is drawn when there's no value.
export function Fact({ label, value }: { label: string; value: ReactNode }) {
    if (value == null || value === '' || value === false) return null;
    return <p className={panel.fact}>{label}: <strong>{value}</strong></p>;
}

// Boxes side by side (they wrap on a narrow panel)
export function DetailBoxes({ children }: { children: ReactNode }) {
    return <div className={panel.boxes}>{children}</div>;
}

// The description, in its own box at the bottom
export function Description({ text }: { text: unknown }) {
    if (typeof text !== 'string' || !text.trim()) return null;
    return (
        <section className={panel.description}>
            <p><strong>Description:</strong> {text}</p>
        </section>
    );
}

// Extra controls under the facts (weapon options, errors)
export function PanelExtras({ children }: { children: ReactNode }) {
    if (Children.toArray(children).length === 0) return null;
    return <div className={panel.extras}>{children}</div>;
}
