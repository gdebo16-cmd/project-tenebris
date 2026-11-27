// Armor, speed, initiative (tap to roll) and proficiency.
import { signed } from '@tenebris/rules/math';
import styles from '../../../styles/components/sheets/blocks/CoreStatsBlock.module.css';
import type { BlockProps } from '../../../features/sheets/types.ts';

export default function CoreStatsBlock({ creature, canEdit, onAct }: Pick<BlockProps, 'creature' | 'canEdit' | 'onAct'>) {
    return (
        <section className={styles.block} aria-label="Core stats">
            <h2 className={styles.title}>Core Stats</h2>
            {/* the tile area: a size container, so the grid can pick its columns from the area's shape (CSS) */}
            <div className={styles.gridArea}>
                <div className={styles.grid4}>
                    <div className={styles.tile}>
                        <span className={styles.tileLabel}>Armor</span>
                        <span className={styles.tileValue}>{creature.armorClass.value}</span>
                        {creature.armorClass.resist.length > 0 && <span className={styles.tileLabel}>Resist {creature.armorClass.resist.join(', ')}</span>}
                    </div>
                    <div className={styles.tile}>
                        <span className={styles.tileLabel}>Speed</span>
                        <span className={styles.tileValue}>{creature.speedFt} ft</span>
                    </div>
                    <button type="button" className={styles.tile} disabled={!canEdit} onClick={() => onAct({ actionKey: 'initiative', kind: 'check' })}>
                        <span className={styles.tileLabel}>Initiative</span>
                        <span className={styles.tileValue}>{signed(creature.initiative)}</span>
                    </button>
                    <div className={styles.tile}>
                        <span className={styles.tileLabel}>Prof.</span>
                        <span className={styles.tileValue}>{signed(creature.proficiency)}</span>
                    </div>
                </div>
            </div>
        </section>
    );
}
