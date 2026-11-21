// The 8 stats (tap to roll a check) and the skills (tap to roll; trained ones are highlighted).
import { signed } from '@tenebris/rules/math';
import styles from '../Sheet.module.css';
import type { BlockProps } from './types.ts';

export default function StatsBlock({ creature, canEdit, onAct }: Pick<BlockProps, 'creature' | 'canEdit' | 'onAct'>) {
    return (
        <section className={styles.block} aria-label="Stats and skills">
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
            <h2 className={styles.heading}>Skills</h2>
            <div className={styles.chips}>
                {creature.skills.map((skill) => (
                    <button key={skill.id} type="button" disabled={!canEdit}
                        className={`${styles.chip} ${skill.proficient ? styles.chipOn : ''}`}
                        title={skill.proficient ? 'Trained' : undefined}
                        onClick={() => onAct({ actionKey: `skill:${skill.id}`, kind: 'check' })}>
                        {skill.name} {signed(skill.value)}
                    </button>
                ))}
            </div>
            <span className={styles.muted}>Tap a stat or skill to roll a check. The server rolls.</span>
        </section>
    );
}
