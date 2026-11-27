import { type FeedEntry } from '../hooks/tableQueries.ts'
import styles from './Feed.module.css'

// The feed: the last few actions, newest on top
export function Feed({ entries }: { entries: FeedEntry[] }) {
    if (entries.length === 0) return null;
    return (
        <ol className={styles.feed} aria-label="What just happened" aria-live="polite">
            {entries.slice(0, 4).map((e) => (
                <li key={e.id} className={styles.feedEntry}>
                    <span className={styles.feedTitle}>{e.title}</span>
                    {e.lines.map((line, i) => <span key={i} className={styles.feedLine}>{line}</span>)}
                </li>
            ))}
        </ol>
    );
}
