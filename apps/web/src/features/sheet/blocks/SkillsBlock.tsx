// The skills (tap to roll a check; trained ones are highlighted). The server rolls.
import { signed } from '@tenebris/rules/math';
import styles from './SkillsBlock.module.css';
import type { BlockProps } from './types.ts';

export default function SkillsBlock({ creature, canEdit, onAct }: Pick<BlockProps, 'creature' | 'canEdit' | 'onAct'>) {
    return (
        <section className={styles.block} aria-label="Skills">
            <h2 className={styles.title}>Skills</h2>
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
        </section>
    );
}
