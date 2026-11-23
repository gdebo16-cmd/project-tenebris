// Afflictions as tiles, 4 across (lit when on): tap to toggle when you may edit. Exhaustion is one wide tile below.
// Others only see the ones that are on.
import styles from './ConditionsBlock.module.css';
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
            <h2 className={styles.title}>Afflictions</h2>
            {shown.length === 0 && <span className={styles.muted}>None</span>}
            {/* the tile area: a size container, so the grid can pick its columns from the area's shape (CSS) */}
            <div className={styles.gridArea}>
                <div className={styles.grid}>
                    {shown.map((name) => (
                        <button key={name} type="button" disabled={!canEdit} aria-pressed={!!on[name]}
                            className={`${styles.tile} ${on[name] ? styles.tileOn : ''}`}
                            onClick={() => onChange({ conditions: { [name]: !on[name] } })}>
                            <span className={styles.tileLabel}>{label(name)}</span>
                        </button>
                    ))}
                </div>
            </div>
            <div className={`${styles.exhaustion} ${creature.exhaustion > 0 ? styles.tileOn : ''}`}>
                {canEdit && (
                    <button type="button" className={styles.step} aria-label="Less exhaustion" disabled={creature.exhaustion <= 0}
                        onClick={() => onChange({ exhaustion: creature.exhaustion - 1 })}>−</button>
                )}
                <span className={styles.exhaustionText}>
                    <span className={styles.tileLabel}>Exhaustion</span>{' '}
                    <span className={styles.tileValue}>{creature.exhaustion} / {MAX_EXHAUSTION}</span>
                </span>
                {canEdit && (
                    <button type="button" className={styles.step} aria-label="More exhaustion" disabled={creature.exhaustion >= MAX_EXHAUSTION}
                        onClick={() => onChange({ exhaustion: creature.exhaustion + 1 })}>+</button>
                )}
            </div>
        </section>
    );
}
