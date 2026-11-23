// The skills as tiles, 5 across (name on top, bonus below). Tap to roll a check; trained ones are highlighted.
// The server rolls.
import { signed } from '@tenebris/rules/math';
import styles from './SkillsBlock.module.css';
import type { BlockProps } from './types.ts';

export default function SkillsBlock({ creature, canEdit, onAct }: Pick<BlockProps, 'creature' | 'canEdit' | 'onAct'>) {
    return (
        <section className={styles.block} aria-label="Skills">
            <h2 className={styles.title}>Skills</h2>
            {/* the tile area: a size container, so the grid can pick its columns from the area's shape (CSS) */}
            <div className={styles.gridArea}>
                <div className={styles.grid}>
                    {creature.skills.map((skill) => (
                        <button key={skill.id} type="button" disabled={!canEdit}
                            className={`${styles.tile} ${skill.proficient ? styles.tileOn : ''}`}
                            title={skill.proficient ? `${skill.name} (trained)` : skill.name}
                            aria-label={`Roll ${skill.name}`}
                            onClick={() => onAct({ actionKey: `skill:${skill.id}`, kind: 'check' })}>
                            <span className={styles.tileLabel}>{skill.name}</span>
                            <span className={styles.tileValue}>{signed(skill.value)}</span>
                        </button>
                    ))}
                </div>
            </div>
        </section>
    );
}
