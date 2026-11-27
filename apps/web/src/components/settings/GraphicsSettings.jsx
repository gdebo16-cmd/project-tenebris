import { GRAPHICS_LEVELS, isGraphicsLevel, useGraphics, writeGraphicsLevel } from '../../features/table/graphicsSettings.ts';
import styles from './Settings.module.css';

const pretty = (s) => s[0].toUpperCase() + s.slice(1);

// Board quality for this device only. Not saved with the board or the account.
export default function GraphicsSettings() {
    const graphics = useGraphics();
    return (
        <section className={styles.group} aria-label="Graphics">
            <h3 className={styles.heading}>Graphics</h3>
            <article className={styles.profileTile}>
                <label className={styles.tileLabel} htmlFor="graphics-quality">Board quality</label>
                <select
                    className={styles.tileValue}
                    id="graphics-quality"
                    value={graphics.level}
                    onChange={(e) => { if (isGraphicsLevel(e.target.value)) writeGraphicsLevel(e.target.value); }}
                >
                    {GRAPHICS_LEVELS.map((level) => (
                        <option key={level} value={level}>{pretty(level)}</option>
                    ))}
                </select>
            </article>
            <p className={styles.hint}>This device only. Not saved with the board or your account.</p>
        </section>
    );
}