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

type Props = { id: string };

type Stat = {
    stat: number;
    index: number;
}
export default function TraitsTab({ id }: Props) {
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
    const [armed, setArmed] = useState<number | null>(null);

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

    function pickRoll(index: number) {
        if (!rolls[index]) return;                       // not rolled yet
        setArmed((current) => current === index ? null : index);   // click again to cancel
    }
    function placeOn(stat: string) {
        if (armed == null) {
            // Nothing picked: clicking a filled stat clears it
            setPlacement((current) => ({ ...current, [stat]: '' }));
            return;
        }
        setPlacement((current) => {
            const next = { ...current };
            for (const key of Object.keys(next)) {
                if (next[key] === String(armed)) next[key] = '';   // a roll can only sit on one stat
            }
            next[stat] = String(armed);
            return next;
        });
        setArmed(null);
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
        <form className={styles.stat} onSubmit={(event) => { event.preventDefault(); onSave(); }}>
            <section className={styles.traits}>
            <div className={styles.rollsContainer}>
                <div className={styles.actions}>
                    <span className={styles.rollsTitle}>Stat Rolls</span>
                    <div className={styles.actionsButtons}>
                        <button type="button" className={styles.secondary} disabled={roller.isPending} onClick={() => reset('placements')}>Reset placements</button>
                        <button type="button" className={styles.secondary} disabled={locked || roller.isPending} onClick={() => reset('rolls')}>Reset rolls</button>
                    </div>
                </div>
                <div className={styles.rollTiles}>
                <ol className={styles.rolls}>
                    {rolls.map((made, index) => {
                        const placedOn = STAT_COLUMNS.find((stat) => placement[stat] === String(index));
                        const tileClass = !made
                            ? styles.rollEmpty
                            : armed === index
                                ? styles.rollArmed      // selected, waiting for a stat
                                : placedOn
                                    ? styles.rollPlaced // already on a stat
                                    : styles.rollPick;  // rolled, tap to place
                        return (
                            <li key={index} className={styles.roll}>
                                <button
                                    type="button"
                                    className={tileClass}
                                    disabled={!made && (locked || roller.isPending)}
                                    onClick={() => (made ? pickRoll(index) : rollOne(index))}
                                >
                                    {made ? (
                                        <>
                                            <Dice roll={made} />
                                            <span className={styles.total}>{made.total}</span>
                                            <span>{placedOn ? `→ ${STAT_LABELS[placedOn]}` : armed === index ? 'Now pick a stat' : 'Tap to place'}</span>
                                        </>
                                    ) : (
                                        <>
                                            <span className={styles.rollTotal}>Roll</span>
                                        </>
                                    )}
                                </button>
                            </li>
                        );
                    })}
                </ol>
                </div>
                <div className={styles.place}>
                    {STAT_COLUMNS.map((stat) => {
                        const raw = placement[stat];
                        const roll = raw == null || raw === '' ? null : rolls[Number(raw)];
                        return (
                            <button key={stat} type="button" className={roll ? styles.statFilled : styles.statEmpty} onClick={() => placeOn(stat)}>
                                <span>{STAT_LABELS[stat]}</span>
                                <span className={styles.statTotal}>{roll ? roll.total : '—'}</span>
                            </button>
                        );
                    })}
                </div>
            </div>
            </section>
            <section className={styles.plusContainer}>
            
                <div className={styles.bonusContainer}>
                    <span className={styles.bonusesTitle}>Bonuses</span>
                    <div className={styles.bonusTiles}>
                    <div className={styles.bonusTile}>
                        <span className={styles.bonusLabel}>+2 Bonus: </span>
                        <StatPick label="+2 bonus" value={plus2} onChange={setPlus2} />
                    </div>
                    <div className={styles.bonusTile}>
                            <span className={styles.bonusLabel}>+1 Bonus: </span>
                            <StatPick label="+1 bonus" value={plus1} onChange={setPlus1} />
                    </div>
                </div>
                </div>
                <div className={styles.giftsContainer}>
                    <span className={styles.giftsTitle}>Gifts</span>
                    <p className={styles.heading}>Choose {giftRule.choose} · {gifts.length} chosen</p>
                    <fieldset className={styles.gifts}>
                        
                        {giftRule.from.map((gift) => {
                            const on = gifts.includes(gift.id);
                            return (
                                <ul className={styles.giftList}>
                                    <li key={gift.id} className={styles.gift}>
                                        <button type="button" className={styles.giftButton} disabled={!on && gifts.length >= giftRule.choose} onClick={() => toggleGift(gift.id)}>
                                            <p  className={styles.giftTitle}>{gift.name} · {gift.tree}</p>
                                            <p className={styles.giftDescription}><strong>Description:</strong> {gift.description}</p>
                                        </button>
                                    </li>
                                </ul>
                            );
                        })}
                    </fieldset>
                 </div>
            
            </section>
            <section className={styles.saveContainer}>
                <button type="submit" className={styles.save} disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save'}</button>
                {error && <p className={formStyles.error} role="alert">{error}</p>}
            </section>
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
        </span>
    );
}

function StatPick({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
    return (
        <select className={styles.bonusSelect} aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>
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
