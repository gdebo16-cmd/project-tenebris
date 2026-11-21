// Eight server-made rolls, placed by the player, plus a +2, a +1, and gifts.
// The browser sends roll indexes and gift ids. It never sends the score numbers.
import { useEffect, useState } from 'react';
import { STAT_COLUMNS } from '@tenebris/rules/characterForm';
import { ApiError } from '../../../api.ts';
import formStyles from '../CharacterForm.module.css';
import styles from './TraitsTab.module.css';
import { useCharacterForm, useSaveTab, useStatRoll } from '../queries.ts';

const STAT_LABELS: Record<string, string> = {
    str: 'Might', dex: 'Precision', con: 'Endurance', int: 'Intellect',
    wis: 'Judgment', cha: 'Confidence', luc: 'Luck', spd: 'Speed',
};

type Roll = { rolls: number[]; dropped: number; total: number } | null;

type Props = { id?: string };

export default function TraitsTab({ id }: Props) {
    if (!id) return <p>Save the header first. Then you can roll stats.</p>;
    return <TraitsFields id={id} />;
}

function TraitsFields({ id }: { id: string }) {
    const form = useCharacterForm(id);
    const save = useSaveTab(id, 'traits');
    const roller = useStatRoll(id);
    const [placement, setPlacement] = useState<Record<string, string>>({});
    const [plus2, setPlus2] = useState('');
    const [plus1, setPlus1] = useState('');
    const [gifts, setGifts] = useState<number[]>([]);
    const [filled, setFilled] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!form.data || filled) return;
        const saved = form.data.traits;
        const next: Record<string, string> = {};
        for (const stat of STAT_COLUMNS) {
            const index = saved.placement[stat];
            if (index != null) next[stat] = String(index);
        }
        setPlacement(next);
        setPlus2(saved.plus2 ?? '');
        setPlus1(saved.plus1 ?? '');
        setGifts(saved.gifts ?? []);
        setFilled(true);
    }, [form.data, filled]);

    if (form.isPending || !form.data) return null;
    if (form.error) return <p className={formStyles.error} role="alert">{messageOf(form.error)}</p>;

    const traits = form.data.traits;
    const rolls = traits.rolls;
    const giftRule = form.data.options.gifts;
    const locked = !form.data.is_draft;

    async function rollOne(index: number) {
        setError('');
        try { await roller.mutateAsync({ index }); }
        catch (err) { setError(messageOf(err)); }
    }

    async function reset(which: 'placements' | 'rolls') {
        setError('');
        try {
            await roller.mutateAsync({ reset: which });
            setPlacement({});
        } catch (err) { setError(messageOf(err)); }
    }

    function toggleGift(giftId: number) {
        setGifts((current) => current.includes(giftId) ? current.filter((id) => id !== giftId) : [...current, giftId]);
    }

    async function onSave() {
        setError('');
        const placed: Record<string, number> = {};
        for (const stat of STAT_COLUMNS) {
            const raw = placement[stat];
            placed[stat] = raw == null || raw === '' ? -1 : Number(raw);
        }
        try {
            await save.mutateAsync({ placement: placed, plus2, plus1, gifts });
        } catch (err) { setError(messageOf(err)); }
    }

    return (
        <form className={styles.traits} onSubmit={(event) => { event.preventDefault(); onSave(); }}>
            <ol className={styles.rolls}>
                {rolls.map((made, index) => (
                    <li key={index} className={styles.roll}>
                        <span>Roll {index + 1}</span>
                        {made ? <Dice roll={made} /> : <span>Not rolled</span>}
                        <button type="button" className={styles.secondary} disabled={locked || roller.isPending} onClick={() => rollOne(index)}>
                            {made ? 'Roll again' : 'Roll'}
                        </button>
                    </li>
                ))}
            </ol>
            <div className={styles.actions}>
                <button type="button" className={styles.secondary} disabled={roller.isPending} onClick={() => reset('placements')}>Reset placements</button>
                <button type="button" className={styles.secondary} disabled={locked || roller.isPending} onClick={() => reset('rolls')}>Reset rolls</button>
            </div>
            <p className={styles.note}>The server keeps the dice. You only choose which roll goes to which stat.</p>
            <div className={styles.place}>
                {STAT_COLUMNS.map((stat) => (
                    <label key={stat}>
                        {STAT_LABELS[stat]}
                        <select aria-label={STAT_LABELS[stat]} value={placement[stat] ?? ''} onChange={(event) => setPlacement((current) => ({ ...current, [stat]: event.target.value }))}>
                            <option value="">Choose a roll</option>
                            {rolls.map((roll, index) => (
                                <option key={index} value={index} disabled={!roll || taken(placement, stat, index)}>
                                    {roll ? `Roll ${index + 1} — ${roll.total}` : `Roll ${index + 1} — not rolled`}
                                </option>
                            ))}
                        </select>
                    </label>
                ))}
            </div>
            <div className={styles.bonuses}>
                <label>
                    +2
                    <StatPick label="+2 bonus" value={plus2} onChange={setPlus2} />
                </label>
                <label>
                    +1
                    <StatPick label="+1 bonus" value={plus1} onChange={setPlus1} />
                </label>
            </div>
            <p className={styles.note}>The +2 and the +1 may be the same stat.</p>
            <fieldset className={styles.gifts}>
                <legend className={styles.heading}>Choose {giftRule.choose} · {gifts.length} chosen</legend>
                {giftRule.from.map((gift) => {
                    const on = gifts.includes(gift.id);
                    return (
                        <label key={gift.id} className={styles.gift}>
                            <input type="checkbox" checked={on} disabled={!on && gifts.length >= giftRule.choose} onChange={() => toggleGift(gift.id)} />
                            {gift.name}
                        </label>
                    );
                })}
            </fieldset>
            <button type="submit" className={formStyles.save} disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save'}</button>
            {error && <p className={formStyles.error} role="alert">{error}</p>}
        </form>
    );
}

function Dice({ roll }: { roll: Exclude<Roll, null> }) {
    let marked = false;
    return (
        <span className={styles.dice}>
            {roll.rolls.map((die, i) => {
                const drop = !marked && die === roll.dropped;
                if (drop) marked = true;
                return <span key={i} className={drop ? styles.dropped : styles.die}>{die}</span>;
            })}
            <span className={styles.total}>{roll.total}</span>
        </span>
    );
}

function StatPick({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
    return (
        <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>
            <option value="">Choose</option>
            {STAT_COLUMNS.map((stat) => <option key={stat} value={stat}>{STAT_LABELS[stat]}</option>)}
        </select>
    );
}

// A roll already given to another stat can't be picked twice.
function taken(placement: Record<string, string>, stat: string, index: number): boolean {
    return STAT_COLUMNS.some((other) => other !== stat && placement[other] === String(index));
}

function messageOf(err: unknown): string {
    if (err instanceof ApiError) return err.message;
    if (err instanceof Error) return err.message;
    return 'Something went wrong';
}
