import { useEffect, useState } from 'react';
import sheet from '../../styles/components/sheets/Sheet.module.css';
import styles from '../../styles/features/dm/DmPage.module.css';
import { useDmTools } from './DmContext.tsx';
import { ErrorLine } from './DmBlockParts.tsx';

export function NotesBlock() {
    const { data, change } = useDmTools();
    const [notes, setNotes] = useState(data.notes);
    useEffect(() => setNotes(data.notes), [data.notes]);
    const saving = change.notes.isPending;
    return (
        <section className={`${sheet.block} ${styles.fillBlock}`} aria-label="DM notes">
            <h2 className={sheet.heading}>Notes</h2>
            <textarea className={`${sheet.input} ${styles.notes}`} maxLength={20000} value={notes} aria-label="DM notes"
                placeholder="Only you see these." onChange={(e) => setNotes(e.target.value)} />
            <button type="button" className={sheet.button} disabled={saving || notes === data.notes} onClick={() => change.notes.mutate(notes)}>
                {saving ? 'Saving…' : 'Save notes'}
            </button>
            <ErrorLine errors={[change.notes.error]} />
        </section>
    );
}
