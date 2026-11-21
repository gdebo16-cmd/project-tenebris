// Role, calling, species and gift features, with their dice and costs. (Using features with embers and
// per-rest uses still happens on the old sheet until the server tracks those uses.)
import styles from '../Sheet.module.css';
import type { BlockProps } from './types.ts';

export default function FeaturesBlock({ creature }: Pick<BlockProps, 'creature'>) {
    return (
        <section className={styles.block} aria-label="Features">
            <h2 className={styles.heading}>Features</h2>
            {creature.features.length === 0 && <span className={styles.muted}>No features with actions yet.</span>}
            {creature.features.map((f) => (
                <div key={`${f.source}-${f.id}`} className={styles.row}>
                    <div className={styles.rowText}>
                        <span className={styles.rowName}>{f.name}</span>
                        <span className={styles.muted}>
                            {[f.action_type, f.dice ? String(f.dice) : null, f.ember_cost != null ? `${String(f.ember_cost)} embers` : null,
                              f.rest_uses != null ? `${String(f.rest_uses)} per ${String(f.rest_lock ?? 'long')} rest` : null].filter(Boolean).join(' · ')}
                        </span>
                        {typeof f.description === 'string' && <span className={styles.muted}>{f.description}</span>}
                    </div>
                </div>
            ))}
        </section>
    );
}
