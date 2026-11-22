// The 8 stats (tap to roll a check). The skills are their own block (SkillsBlock).
import { signed } from '@tenebris/rules/math';
import styles from './StatsBlock.module.css';
import type { BlockProps } from './types.ts';

export default function StatsBlock({ creature, canEdit, onAct }: Pick<BlockProps, 'creature' | 'canEdit' | 'onAct'>) {
    return (
        <section className={styles.block} aria-label="Stats">
            <h2 className={styles.title}>Primary Stats</h2>
            <div className={styles.grid4}>
                {creature.stats.map((stat) => (
                    <button key={stat.key} type="button" className={styles.tile} disabled={!canEdit} aria-label={`Roll ${stat.label}`}
                        onClick={() => onAct({ actionKey: `stat:${stat.key}`, kind: 'check' })}>
                        <span className={styles.tileLabel}>{stat.label}</span>
                        <span className={styles.tileValue}>{signed(stat.mod)}</span>
                        <span className={styles.tileLabel}>{stat.score}</span>
                    </button>
                ))}
            </div>
        </section>
    );
}
