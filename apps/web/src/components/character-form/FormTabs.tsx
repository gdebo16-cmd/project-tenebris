// The five tabs. The open one lives in the URL (?tab=species) so a reload stays on it.
import { useEffect, useRef, type KeyboardEvent } from 'react';
import styles from '../../styles/features/character-form/CharacterForm.module.css';

export const FORM_TAB_LIST = [
    { id: 'species', long: 'Species & look', short: 'Species' },
    { id: 'role', long: 'Role & calling', short: 'Role' },
    { id: 'traits', long: 'Traits & gifts', short: 'Traits' },
    { id: 'personality', long: 'Personality', short: 'Persona' },
    { id: 'gear', long: 'Inventory', short: 'Gear' },
] as const;

export type FormTabId = (typeof FORM_TAB_LIST)[number]['id'];

type Props = {
    active: FormTabId;
    onSelect: (tab: FormTabId) => void;
};

export function isFormTab(value: string | null): value is FormTabId {
    return FORM_TAB_LIST.some((tab) => tab.id === value);
}

export default function FormTabs({ active, onSelect }: Props) {
    const buttons = useRef<(HTMLButtonElement | null)[]>([]);
    // Arrow keys move the tab; we focus the new one after React paints it.
    const focusIndex = useRef<number | null>(null);

    useEffect(() => {
        if (focusIndex.current == null) return;
        buttons.current[focusIndex.current]?.focus();
        focusIndex.current = null;
    }, [active]);

    function move(index: number) {
        const next = (index + FORM_TAB_LIST.length) % FORM_TAB_LIST.length;
        focusIndex.current = next;
        onSelect(FORM_TAB_LIST[next].id);
    }

    function onKeyDown(event: KeyboardEvent) {
        const index = FORM_TAB_LIST.findIndex((tab) => tab.id === active);
        if (event.key === 'ArrowRight') { event.preventDefault(); move(index + 1); }
        if (event.key === 'ArrowLeft') { event.preventDefault(); move(index - 1); }
        if (event.key === 'Home') { event.preventDefault(); move(0); }
        if (event.key === 'End') { event.preventDefault(); move(FORM_TAB_LIST.length - 1); }
    }

    return (
        <div className={styles.tabList} role="tablist" aria-label="Character form" onKeyDown={onKeyDown}>
            {FORM_TAB_LIST.map((tab, index) => {
                const selected = tab.id === active;
                return (
                    <button
                        key={tab.id}
                        ref={(el) => { buttons.current[index] = el; }}
                        id={`tab-${tab.id}`}
                        type="button"
                        role="tab"
                        className={selected ? styles.tabSelected : styles.tab}
                        aria-selected={selected}
                        aria-controls={`panel-${tab.id}`}
                        tabIndex={selected ? 0 : -1}
                        onClick={() => onSelect(tab.id)}
                    >
                        <span className={styles.longName}>{tab.long}</span>
                        <span className={styles.shortName}>{tab.short}</span>
                    </button>
                );
            })}
        </div>
    );
}
