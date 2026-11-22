// Name, level and portrait. Stays on screen no matter which tab is open.
import { useState } from 'react';
import { levelChoices, DEFAULT_CHARACTER_NAME } from '@tenebris/rules/characterForm';
import styles from './CharacterForm.module.css';
import { usePortraits } from './queries.ts';

const DEFAULT_PORTRAIT = '/default-character.png';

type Props = {
    name: string;
    level: string;
    savedLevel?: number | null;
    portraitUrl: string | null;
    summary: string;
    saving: boolean;
    error: string;
    onName: (name: string) => void;
    onLevel: (level: string) => void;
    onPortrait: (url: string | null) => void;
    onSave: () => void;
};

export default function FormHeader({ name, level, savedLevel, portraitUrl, summary, saving, error, onName, onLevel, onPortrait, onSave }: Props) {
    const portraits = usePortraits();
    const [open, setOpen] = useState(false);
    const groups = groupPortraits(portraits.data ?? []);

    return (
        <form className={styles.header} onSubmit={(event) => { event.preventDefault(); onSave(); }}>
            <button
                type="button"
                className={styles.portraitButton}
                aria-expanded={open}
                aria-label={open ? 'Close portraits' : 'Choose a portrait'}
                onClick={() => setOpen((was) => !was)}
            >
                <img className={styles.portrait} src={portraitUrl ?? DEFAULT_PORTRAIT} alt="" />
            </button>
            <div className={styles.headerFields}>
                <div className={styles.nameLevel}>
                    <label className={styles.field}>
                        <span className={styles.label}>Name</span>
                        <input className={styles.input} value={name} onChange={(event) => onName(event.target.value)} aria-label="Name" autoComplete="off" onBlur={onSave} placeholder={DEFAULT_CHARACTER_NAME} />
                    </label>
                    <label className={styles.field}>
                        <span className={styles.label}>Level</span>
                        <select className={styles.input} aria-label="Level" value={level} onChange={(event) => onLevel(event.target.value)}>
                            {levelChoices(savedLevel ?? Number(level)).map((n) => (
                                <option key={n} value={String(n)}>{`Lv ${n}`}</option>
                            ))}
                        </select>
                    </label>
                </div>
                <p className={styles.summary}>{summary}</p>
                {saving && <p className={styles.summary} role="status">Saving…</p>}
                {error && <p className={styles.error} role="alert">{error}</p>}
            </div>
            {open && (
                <div className={styles.portraitPanel}>
                    <button type="button" className={portraitUrl == null ? styles.portraitPickSelected : styles.portraitPick} onClick={() => onPortrait(null)}>
                        <img src={DEFAULT_PORTRAIT} alt="" />
                        Default
                    </button>
                    {groups.map((group) => (
                        <section key={group.name}>
                            <h2 className={styles.portraitGroup}>{group.name}</h2>
                            <div className={styles.portraitGrid}>
                                {group.items.map((shot) => {
                                    const url = `/portraits/${shot.file}`;
                                    const selected = url === portraitUrl;
                                    return (
                                        <button
                                            key={shot.file}
                                            type="button"
                                            className={selected ? styles.portraitPickSelected : styles.portraitPick}
                                            aria-pressed={selected}
                                            aria-label={shot.label}
                                            onClick={() => onPortrait(url)}
                                        >
                                            <img src={url} alt="" />
                                            {shot.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </section>
                    ))}
                </div>
            )}
        </form>
    );
}

// Keep the groups in the order the file lists them.
function groupPortraits(shots: { file: string; label: string; group: string }[]) {
    const groups: { name: string; items: typeof shots }[] = [];
    for (const shot of shots) {
        const found = groups.find((group) => group.name === shot.group);
        if (found) found.items.push(shot);
        else groups.push({ name: shot.group, items: [shot] });
    }
    return groups;
}
