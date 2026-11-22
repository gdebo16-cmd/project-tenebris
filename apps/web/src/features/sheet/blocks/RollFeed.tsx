// Recent rolls, newest first: your own and the ones other people at the table share.
// Rendered on the campaign DM's view of a character sheet; the owner sees the roll orb instead.
import styles from '../Sheet.module.css';

export type FeedEntry = { id: number; who: string; text: string; mine?: boolean };

export default function RollFeed({ entries }: { entries: FeedEntry[] }) {
    return (
        <section className={styles.block} aria-label="Rolls" aria-live="polite">
            <h2 className={styles.heading}>Rolls</h2>
            {entries.length === 0 && <span className={styles.muted}>Nothing rolled yet.</span>}
            {entries.map((e) => (
                <div key={e.id} className={styles.feedRow}>
                    <span>{e.text}</span>
                    <span className={styles.muted}>{e.who}</span>
                </div>
            ))}
        </section>
    );
}
