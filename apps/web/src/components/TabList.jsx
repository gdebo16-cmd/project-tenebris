// A row of tab buttons. "tabs" is a list like [{ id: 'armor', label: 'Armor' }].
// prefix builds the same ids the EJS pages used, e.g. "inv" -> inv-tab-armor / inv-panel-armor.
// className is added to the bar's own class, so a parent can adjust it from its module.
import useTabSlider from '../hooks/useTabSlider';
import styles from './TabList.module.css';

function TabList({ tabs, active, onChange, prefix, className, hidden }) {
    const { tabProps, barProps, slideStyle } = useTabSlider(tabs.findIndex((t) => t.id === active));
    return (
        <article className={className ? `${styles.tabList} ${className}` : styles.tabList} role="tablist" hidden={hidden} {...barProps}>
            {tabs.map((t, i) => (
                <button
                    key={t.id}
                    type="button"
                    role="tab"
                    className={styles.tab}
                    id={`${prefix}tab-${t.id}`}
                    aria-controls={`${prefix}panel-${t.id}`}
                    aria-selected={active === t.id}
                    onClick={() => onChange(t.id)}
                    {...tabProps(i)}
                >
                    {t.label}
                </button>
            ))}
            <span className={styles.slide} aria-hidden="true" style={slideStyle} />
        </article>
    );
}

export default TabList;
