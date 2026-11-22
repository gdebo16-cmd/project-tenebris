import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../api.ts';
import { keys } from '../../queries.ts';
import styles from './Settings.module.css';

const THEMES = ['default', 'green', 'purple', 'blue', 'red', 'orange', 'yellow', 'dark', 'light', 'hellfire', 'frozen', 'neon', 'gestalt', 'shadow-of-the-mountains', 'prestige', 'glass-green', 'glass-blue', 'glass-red', 'glass-orange', 'glass-yellow', 'glass-fire', 'dark-glass', 'light-glass', 'neon-glass', 'frozen-glass', 'gothic', 'pilgrim'];
const DISPLAYS = ['standard', 'compact', 'neon', 'glass', 'parchment', 'minimal', 'bold', 'shadow-of-the-mountains', 'gestalt'];
const BACKGROUNDS = ['default', 'green', 'purple', 'blue', 'red', 'orange', 'yellow', 'dark', 'light', 'hellfire', 'frozen', 'neon', 'gestalt', 'shadow-of-the-mountains', 'dark-map', 'light-map', 'hellfire-map', 'frozen-map', 'gothic', 'haunted-forest', 'frozen-fortress', 'volcanic-forge', 'sunken-ruins', 'elven-grove', 'desert-tomb', 'storm-lighthouse', 'throne-hall', 'arcane-observatory', 'autumn-village', 'teal', 'rose', 'amber-dusk', 'moonlit', 'emerald-mist', 'twilight', 'ash', 'copper', 'ocean', 'aurora', 'crimson-night', 'ivory-dawn', 'lavender'];
// 'glass-blue' -> 'Glass Blue'
const pretty = (s) => s.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');

// Color scheme, display and background: shown at once, remembered on this device, saved to the account.
export default function LookSettings() {
    const queryClient = useQueryClient();
    const pick = (field, storageKey, attr) => async (e) => {
        const next = e.target.value;
        document.documentElement.setAttribute(attr, next);
        localStorage.setItem(storageKey, next);
        await api('/api/profile', { method: 'PUT', body: { [field]: next } });
        queryClient.invalidateQueries({ queryKey: keys.profile });
    };

    const select = (id, label, list, storageKey, fallback, onChange) => (
        <article className={styles.profileTile}>
            <label className={styles.tileLabel} htmlFor={id}>{label}</label>
            <select className={styles.tileValue} id={id} defaultValue={localStorage.getItem(storageKey) || fallback} onChange={onChange}>
                {list.map((v) => <option key={v} value={v}>{pretty(v)}</option>)}
            </select>
        </article>
    );

    return (
        <section className={styles.group} aria-label="Look">
            <h3 className={styles.heading}>Look</h3>
            {select('theme-select', 'Color scheme', THEMES, 'siteTheme', 'default', pick('site_theme', 'siteTheme', 'data-theme'))}
            {select('display-select', 'Display', DISPLAYS, 'siteDisplay', 'standard', pick('site_display', 'siteDisplay', 'data-display'))}
            {select('background-select', 'Background', BACKGROUNDS, 'siteBackground', 'default', pick('site_background', 'siteBackground', 'data-background'))}
        </section>
    );
}