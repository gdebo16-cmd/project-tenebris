// Condition chips: tap to toggle (when you may edit), plus exhaustion. Others only see the ones that are on.
import styles from '../Sheet.module.css';
import type { BlockProps } from './types.ts';

// The 12 conditions (characters.conditions keys) and the exhaustion cap come from the rules, which the server checks too
import { CONDITIONS, MAX_EXHAUSTION } from '@tenebris/rules/sheetState';
const label = (name: string) => name[0].toUpperCase() + name.slice(1);

type Props = Pick<BlockProps, 'creature' | 'canEdit'> & {
    onChange: (patch: { conditions?: Record<string, boolean>; exhaustion?: number }) => void;
};

export default function ConditionsBlock({ creature, canEdit, onChange }: Props) {
    const on = creature.conditions;
    const shown = canEdit ? CONDITIONS : CONDITIONS.filter((name) => on[name]);
    return (
        <section className={styles.block} aria-label="Conditions">
            <div className={styles.chips}>
                <h2 className={styles.heading}>Conditions</h2>
                {shown.length === 0 && <span className={styles.muted}>None</span>}
                {shown.map((name) => (
                    <button key={name} type="button" disabled={!canEdit} aria-pressed={!!on[name]}
                        className={`${styles.chip} ${on[name] ? styles.chipOn : ''}`}
                        onClick={() => onChange({ conditions: { [name]: !on[name] } })}>
                        {label(name)}
                    </button>
                ))}
            </div>
            <div className={styles.chips}>
                <span className={styles.muted}>Exhaustion {creature.exhaustion}</span>
                {canEdit && (
                    <>
                        <button type="button" className={styles.chip} aria-label="Less exhaustion" disabled={creature.exhaustion <= 0}
                            onClick={() => onChange({ exhaustion: creature.exhaustion - 1 })}>−</button>
                        <button type="button" className={styles.chip} aria-label="More exhaustion" disabled={creature.exhaustion >= MAX_EXHAUSTION}
                            onClick={() => onChange({ exhaustion: creature.exhaustion + 1 })}>+</button>
                    </>
                )}
            </div>
        </section>
    );
}
