// Role, calling, species and gift features, with their dice and uses per rest.
// Use (only when you may edit) asks the server to spend one use and roll the feature's dice;
// the uses left come back with the sheet. A short or long rest gives them back.
import styles from './FeaturesBlock.module.css';
import panelCss from './ActionPanel.module.css';
import type { BlockProps } from './types.ts';

type Props = Pick<BlockProps, 'creature' | 'canEdit'> & { onUse: (featureKey: string) => void };

export default function FeaturesBlock({ creature, canEdit, onUse }: Props) {
    // a monster's legendary actions have their own block (LegendaryBlock)
    const features = creature.features.filter((f) => f.action_type !== 'legendary');
    return (
        <section className={styles.block} aria-label="Features">
            <h2 className={`${styles.heading} ${panelCss.title}`}>Features</h2>
            {features.length === 0 && <span className={styles.muted}>No features with actions yet.</span>}
            {features.map((f) => {
                const uses = f.perRest;
                const canUse = canEdit && (uses != null || f.diceNow != null);
                return (
                    <div key={f.key} className={`${styles.row} ${panelCss.row}`}>
                        <div className={styles.rowText}>
                            <span className={`${styles.rowName} ${panelCss.name}`}>{f.name}</span>
                            <div className={styles.muted}>
                                {[f.action_type, f.diceNow,
                                  uses ? `${uses.left}/${uses.max} uses left · back on a ${uses.rest} rest` : null].filter(Boolean).join(' · ')}
                            </div>
                            {typeof f.description === 'string' && <div className={styles.muted}>{f.description}</div>}
                        </div>
                        {canUse && (
                            <div className={`${styles.rowButtons} ${panelCss.buttons}`}>
                                <button type="button" className={`${styles.button} ${styles.primary}`} disabled={uses != null && uses.left <= 0}
                                    aria-label={`Use ${f.name}`} onClick={() => onUse(f.key)}>
                                    {uses != null && uses.left <= 0 ? `Used (${uses.rest} rest)` : 'Use'}
                                </button>
                            </div>
                        )}
                    </div>
                );
            })}
        </section>
    );
}
