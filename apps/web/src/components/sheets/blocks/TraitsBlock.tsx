// A monster's traits: resistances, immunities, weaknesses, senses, movement, languages, saves, and the DM's notes.
import { useEffect, useState } from 'react';
import type { Creature } from '@tenebris/rules/creature';
import styles from '../../../styles/components/sheets/blocks/TraitsBlock.module.css';

type Props = { creature: Creature; canEdit: boolean; onSaveNotes: (notes: string) => void; saving?: boolean };

const feet = (rec: Record<string, number>) => Object.entries(rec).map(([k, v]) => `${k} ${v} ft`).join(', ');

export default function TraitsBlock({ creature, canEdit, onSaveNotes, saving }: Props) {
    const m = creature.monster;
    const [notes, setNotes] = useState(m?.notes ?? '');
    useEffect(() => setNotes(m?.notes ?? ''), [m?.notes]);
    if (!m) return null;

    const lines: [string, string][] = [
        ['Resistances', m.resistances.join(', ')],
        ['Immunities', m.immunities.join(', ')],
        ['Weaknesses', m.weaknesses.join(', ')],
        ['Condition immunities', m.conditionImmunities.join(', ')],
        ['Senses', feet(m.senses)],
        ['Movement', feet(m.movement)],
        ['Languages', m.languages.join(', ')],
        ['Saves', m.saves.join(', ')],
        ['Hit dice', m.hitDice ?? ''],
    ];
    const shown = lines.filter(([, value]) => value);

    return (
        <section className={styles.block} aria-label="Traits">
            <h2 className={styles.heading}>Traits</h2>
            {m.description && <span className={styles.muted}>{m.description}</span>}
            {m.multiattack && <span>Multiattack: it can use several of its attacks in one action.</span>}
            {shown.map(([label, value]) => (
                <div key={label} className={styles.row}>
                    <span className={styles.rowName}>{label}</span>
                    <span className={styles.muted}>{value}</span>
                </div>
            ))}
            {canEdit && (
                <label className={styles.notes}>
                    DM notes (only you see these)
                    <textarea className={`${styles.input} ${styles.notesBox}`} rows={3} maxLength={20000} value={notes} onChange={(e) => setNotes(e.target.value)} />
                    <button type="button" className={styles.button} disabled={saving || notes === m.notes} onClick={() => onSaveNotes(notes)}>
                        {saving ? 'Saving…' : 'Save notes'}
                    </button>
                </label>
            )}
        </section>
    );
}
