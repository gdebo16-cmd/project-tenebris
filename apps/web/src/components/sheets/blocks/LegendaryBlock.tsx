// A monster's legendary actions (monster sheets only). Every monster has this block; one without
// legendary actions says so. They come from the monster's `legendary_actions` in the content pack.
import styles from '../../../styles/components/sheets/blocks/LegendaryBlock.module.css';
import panelCss from '../../../styles/components/sheets/blocks/ActionPanel.module.css';
import type { BlockProps } from '../../../features/sheets/types.ts';

export default function LegendaryBlock({ creature }: Pick<BlockProps, 'creature'>) {
    const legendary = creature.features.filter((f) => f.action_type === 'legendary');
    return (
        <section className={styles.block} aria-label="Legendary actions">
            <h2 className={`${styles.heading} ${panelCss.title}`}>Legendary Actions</h2>
            {legendary.length === 0 && <span className={styles.muted}>No legendary actions.</span>}
            {legendary.map((f) => (
                <div key={f.key} className={`${styles.row} ${panelCss.row}`}>
                    <span className={`${styles.rowName} ${panelCss.name}`}>{f.name}</span>
                    {typeof f.description === 'string' && <div className={styles.muted}>{f.description}</div>}
                </div>
            ))}
        </section>
    );
}
