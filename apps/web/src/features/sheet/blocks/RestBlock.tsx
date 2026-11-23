// Short and long rests (only when you may edit). The server rolls the recovery and saves everything a rest
// changes: HP, temporary HP, spell slots, conditions, exhaustion and uses per rest. Asks first, like the old sheet.
import { useState } from 'react';
import styles from './RestBlock.module.css';
import CampfireIcon from '../../../components/CampfireIcon.tsx';

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
            <h2 className={styles.title}>Rest</h2>
            <div className={styles.restLine}>
                {!open ? (
                    <button type="button" className={`${styles.button} ${styles.restButton}`} disabled={busy} onClick={() => setOpen(true)}
                        aria-label="Rest" title="Rest">
                        <CampfireIcon size={28} />
                    </button>
                ) : (
                    <div className={styles.rowButtons}>
                        <button type="button" className={`${styles.button} ${styles.primary}`} disabled={busy} onClick={() => rest('short')}>Short Rest</button>
                        <button type="button" className={`${styles.button} ${styles.primary}`} disabled={busy} onClick={() => rest('long')}>Long Rest</button>
                        <button type="button" className={styles.button} onClick={() => setOpen(false)}>Cancel</button>
                    </div>
                )}
            </div>

        </section>
    );
}
