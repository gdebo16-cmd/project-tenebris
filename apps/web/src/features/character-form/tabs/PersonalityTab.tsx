// Alignment is the real 3 by 3 chart. Each personality pick gives one magic state, and the three must differ.
import { useEffect, useState } from 'react';
import { ApiError } from '../../../api.ts';
import formStyles from '../CharacterForm.module.css';
import styles from './PersonalityTab.module.css';
import { useCharacterForm, useSaveTab } from '../queries.ts';
import type { Options } from '@tenebris/rules/characterForm';

const LAW = [
    { axis: -1, label: 'Lawful' },
    { axis: 0, label: 'Natural' },
    { axis: 1, label: 'Chaotic' },
];
const GOOD = [
    { axis: 1, label: 'Good' },
    { axis: 0, label: 'Natural' },
    { axis: -1, label: 'Evil' },
];

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
            <div className={styles.chart} role="radiogroup" aria-label="Alignment">
                <span />
                {LAW.map((col) => <span key={col.axis} className={styles.axis}>{col.label}</span>)}
                {GOOD.map((row) => (
                    <span key={row.axis} className={styles.contents}>
                        <span className={styles.axis}>{row.label}</span>
                        {LAW.map((col) => {
                            const alignment = options.alignments.find((item) => item.law_axis === col.axis && item.good_axis === row.axis);
                            if (!alignment) return <span key={col.axis} />;
                            return (
                                <button
                                    key={alignment.code}
                                    type="button"
                                    role="radio"
                                    aria-checked={code === alignment.code}
                                    className={styles.cell}
                                    onClick={() => setCode(alignment.code)}
                                >
                                    {alignment.name}
                                </button>
                            );
                        })}
                    </span>
                ))}
            </div>
            <div className={styles.picks}>
                {PICKS.map((pick) => {
                    const list = options[pick.list];
                    const picked = optionOf(pick.key);
                    const taken = takenBy(pick.key);
                    const choices = list.filter((item) => String(item.id) === ids[pick.key] || item.any_state || !item.state || !taken.includes(item.state));
                    return (
                        <label key={pick.key}>
                            {pick.label}
                            <select aria-label={pick.label} value={ids[pick.key]} onChange={(event) => {
                                setIds((current) => ({ ...current, [pick.key]: event.target.value }));
                                setWild((current) => ({ ...current, [pick.key]: '' }));
                            }}>
                                <option value="">Choose</option>
                                {choices.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                            </select>
                            {picked && !picked.any_state && <span className={styles.note}>{picked.flavor ?? `State: ${picked.state}`}</span>}
                            {picked?.any_state && (
                                <select aria-label={`${pick.label} state`} value={wild[pick.key]} onChange={(event) => setWild((current) => ({ ...current, [pick.key]: event.target.value }))}>
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
            <button type="submit" className={formStyles.save} disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save'}</button>
            {error && <p className={formStyles.error} role="alert">{error}</p>}
        </form>
    );
}

function messageOf(err: unknown): string {
    if (err instanceof ApiError) return err.message;
    if (err instanceof Error) return err.message;
    return 'Something went wrong';
}
