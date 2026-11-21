// Short and long rests (only when you may edit). The server rolls the recovery and saves everything a rest
// changes: HP, temporary HP, spell slots, conditions, exhaustion and uses per rest. Asks first, like the old sheet.
import { useState } from 'react';
import styles from '../Sheet.module.css';

type Props = { canEdit: boolean; busy: boolean; onRest: (type: 'short' | 'long') => void };

export default function RestBlock({ canEdit, busy, onRest }: Props) {
    const [open, setOpen] = useState(false);
    if (!canEdit) return null;

    function rest(type: 'short' | 'long') {
        onRest(type);
        setOpen(false);
    }

    return (
        <section className={styles.block} aria-label="Rest">
            <div className={styles.restLine}>
                <h2 className={styles.heading}>Rest</h2>
                {!open ? (
                    <button type="button" className={styles.button} disabled={busy} onClick={() => setOpen(true)}>Rest</button>
                ) : (
                    <div className={styles.rowButtons}>
                        <button type="button" className={`${styles.button} ${styles.primary}`} disabled={busy} onClick={() => rest('short')}>Short Rest</button>
                        <button type="button" className={`${styles.button} ${styles.primary}`} disabled={busy} onClick={() => rest('long')}>Long Rest</button>
                        <button type="button" className={styles.button} onClick={() => setOpen(false)}>Cancel</button>
                    </div>
                )}
            </div>
            <span className={styles.muted}>Short: 20–60% of missing HP, spent slots and exhaustion back; short-rest uses reset. Long: everything back.</span>
        </section>
    );
}
