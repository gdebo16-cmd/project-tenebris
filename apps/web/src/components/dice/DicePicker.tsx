import { type ReactNode } from 'react';
import styles from '../../styles/features/dice/DiceLab.module.css';

// The dice the lab can roll (no d10 yet: it needs a hand-built shape)
const DICE = [4, 6, 8, 12, 20];

// Flat outlines of each die for the picker buttons (viewBox 0â€“100). currentColor = the button's text colour.
const DIE_ICONS: Record<number, ReactNode> = {
    4:  <><polygon points="50,8 92,86 8,86" /><line x1="50" y1="8" x2="50" y2="86" /></>,
    6:  <><rect x="14" y="14" width="72" height="72" rx="8" /></>,
    8:  <><polygon points="50,6 90,50 50,94 10,50" /><line x1="10" y1="50" x2="90" y2="50" /></>,
    12: <><polygon points="50,6 92,37 76,88 24,88 8,37" /><polygon points="50,26 70,42 62,66 38,66 30,42" /></>,
    20: <><polygon points="50,4 90,27 90,73 50,96 10,73 10,27" /><polygon points="50,24 74,64 26,64" /></>,
};

// One button per die: its outline, and "D20" underneath. Each click adds one of that die to the pool.
// A die already in the pool is highlighted and shows how many: "D6 Ã—2".
export function DicePicker({ pool, onPick }: { pool: number[]; onPick: (d: number) => void }) {
    return (
        <div className={styles.picker} role="group" aria-label="Add a die">
            {DICE.map((d) => {
                const count = pool.filter((p) => p === d).length;
                return (
                    <button key={d} type="button"
                        className={count > 0 ? `${styles.die} ${styles.dieOn}` : styles.die}
                        onClick={() => onPick(d)}>
                        <svg viewBox="0 0 100 100" aria-hidden="true">{DIE_ICONS[d]}</svg>
                        <span>D{d}{count > 0 && ` Ã—${count}`}</span>
                    </button>
                );
            })}
        </div>
    );
}

// The pool in dice notation: [6, 6, 8] -> "2d6 + 1d8"
export function notation(pool: number[]) {
    return DICE.filter((d) => pool.includes(d))
        .map((d) => `${pool.filter((p) => p === d).length}d${d}`)
        .join(' + ');
}

