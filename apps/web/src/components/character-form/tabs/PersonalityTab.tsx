// Alignment is the real 3 by 3 chart. Each personality pick gives one magic state, and the three must differ.
import { useEffect, useState } from 'react';
import { ApiError } from '../../../api.ts';
import formStyles from '../../../styles/features/character-form/CharacterForm.module.css';
import styles from '../../../styles/components/character-form/tabs/PersonalityTab.module.css';
import { useCharacterForm, useSaveTab } from '../../../features/character-form/queries.ts';
import type { Options } from '@tenebris/rules/characterForm';

// Columns run Lawful, Natural, Chaotic; rows run Good, Natural, Evil.
const LAW = [-1, 0, 1];
const GOOD = [1, 0, -1];

const PICKS = [
    { key: 'upbringing', list: 'upbringings', label: 'Upbringing' },
    { key: 'lifestyle', list: 'lifestyles', label: 'Lifestyle' },
    { key: 'outlook', list: 'outlooks', label: 'Outlook' },
] as const;

type PickKey = (typeof PICKS)[number]['key'];
type PersonalityOption = Options['upbringings'][number];

type Props = { id: string };

export default function PersonalityTab({ id }: Props) {
    return <PersonalityFields id={id} />;
}

function PersonalityFields({ id }: { id: string }) {
    const form = useCharacterForm(id);
    const save = useSaveTab(id, 'personality');
    const [code, setCode] = useState('');
    const [ids, setIds] = useState<Record<PickKey, string>>({ upbringing: '', lifestyle: '', outlook: '' });
    const [wild, setWild] = useState<Record<PickKey, string>>({ upbringing: '', lifestyle: '', outlook: '' });
    const [filled, setFilled] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!form.data || filled) return;
        const saved = form.data.personality;
        setCode(saved.alignment_code ?? '');
        setIds({
            upbringing: saved.upbringing_id == null ? '' : String(saved.upbringing_id),
            lifestyle: saved.lifestyle_id == null ? '' : String(saved.lifestyle_id),
            outlook: saved.outlook_id == null ? '' : String(saved.outlook_id),
        });
        setWild({
            upbringing: saved.upbringing_state ?? '',
            lifestyle: saved.lifestyle_state ?? '',
            outlook: saved.outlook_state ?? '',
        });
        setFilled(true);
    }, [form.data, filled]);

    if (form.error) return <p className={formStyles.error} role="alert">{messageOf(form.error)}</p>;
    if (form.isPending || !form.data) return null;

    const options = form.data.options;

    function optionOf(key: PickKey): PersonalityOption | undefined {
        const list = key === 'upbringing' ? options.upbringings : key === 'lifestyle' ? options.lifestyles : options.outlooks;
        return list.find((item) => String(item.id) === ids[key]);
    }

    function stateOf(key: PickKey): string {
        const picked = optionOf(key);
        if (!picked) return '';
        return picked.any_state ? wild[key] : (picked.state ?? '');
    }

    function takenBy(key: PickKey): string[] {
        return PICKS.filter((pick) => pick.key !== key).map((pick) => stateOf(pick.key)).filter(Boolean);
    }

    async function onSave() {
        setError('');
        const body: Record<string, string | null> = { alignment_code: code };
        for (const pick of PICKS) {
            body[`${pick.key}_id`] = ids[pick.key];
            body[`${pick.key}_state`] = wild[pick.key] || null;
        }
        try { await save.mutateAsync(body); }
        catch (err) { setError(messageOf(err)); }
    }

    return (
        <form className={styles.personality} onSubmit={(event) => { event.preventDefault(); onSave(); }}>
            <section className={styles.card}>
                <h2 className={styles.cardTitle}>Alignment</h2>
                <div className={styles.chart} role="radiogroup" aria-label="Alignment">
                    {GOOD.map((good) => LAW.map((law) => {
                        const alignment = options.alignments.find((item) => item.law_axis === law && item.good_axis === good);
                        if (!alignment) return <span key={`${law}:${good}`} />;
                        const on = code === alignment.code;
                        return (
                            <button
                                key={alignment.code}
                                type="button"
                                role="radio"
                                aria-checked={on}
                                aria-label={alignment.name}
                                className={on ? styles.cellSelected : styles.cell}
                                onClick={() => setCode(alignment.code)}
                            >
                                <span className={styles.cellCode}>{alignment.code}</span>
                                <span className={styles.cellName}>{alignment.name}</span>
                            </button>
                        );
                    }))}
                </div>
            </section>
            <section className={styles.card}>
                <h2 className={styles.cardTitle}>Background</h2>
                <div className={styles.picks}>
                    {PICKS.map((pick) => {
                        const list = options[pick.list];
                        const picked = optionOf(pick.key);
                        const taken = takenBy(pick.key);
                        const choices = list.filter((item) => String(item.id) === ids[pick.key] || item.any_state || !item.state || !taken.includes(item.state));
                        return (
                            <label key={pick.key} className={styles.pick}>
                                <span className={styles.pickLabel}>{pick.label}</span>
                                <select className={styles.select} aria-label={pick.label} value={ids[pick.key]} onChange={(event) => {
                                    setIds((current) => ({ ...current, [pick.key]: event.target.value }));
                                    setWild((current) => ({ ...current, [pick.key]: '' }));
                                }}>
                                    <option value="">Choose</option>
                                    {choices.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                                </select>
                                {picked && !picked.any_state && <span className={styles.note}>{picked.flavor ?? `State: ${picked.state}`}</span>}
                                {picked?.any_state && (
                                    <select className={styles.select} aria-label={`${pick.label} state`} value={wild[pick.key]} onChange={(event) => setWild((current) => ({ ...current, [pick.key]: event.target.value }))}>
                                        <option value="">Choose a state</option>
                                        {options.states.filter((state) => state === wild[pick.key] || !taken.includes(state)).map((state) => (
                                            <option key={state} value={state}>{state}</option>
                                        ))}
                                    </select>
                                )}
                            </label>
                        );
                    })}
                </div>
            </section>
            <div className={styles.actions}>
                {error && <p className={formStyles.error} role="alert">{error}</p>}
                <button type="submit" className={styles.save} disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save'}</button>
            </div>
        </form>
    );
}

function messageOf(err: unknown): string {
    if (err instanceof ApiError) return err.message;
    if (err instanceof Error) return err.message;
    return 'Something went wrong';
}
