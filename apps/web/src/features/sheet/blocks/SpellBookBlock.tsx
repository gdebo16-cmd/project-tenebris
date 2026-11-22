// The spell book (only when you may edit): the spells you know, with Prepare / Action / Forget,
// and the open book to learn new ones. Every change goes to the server, which checks the caps
// (the same rules as the old sheet) and answers an error when you're at a limit.
import { useState } from 'react';
import { ApiError } from '../../../api.ts';
import styles from './SpellBookBlock.module.css';
import panelCss from './ActionPanel.module.css';
import { useSpellbook, useSpellbookChange, type SpellbookOp } from '../queries.ts';
import type { BlockProps } from './types.ts';
import DetailsPanel from './DetailsPanel.tsx';
import { SpellInfo } from './details.tsx';

type Props = Pick<BlockProps, 'creature' | 'canEdit'> & { id: string };

const levelName = (level: number) => (level === 0 ? 'Cantrips' : `Level ${level}`);
// Race starter and bonus spells are free: always known, never counted, can't be forgotten
const free = (s: { is_racial?: boolean; is_bonus?: boolean }) => !!(s.is_racial || s.is_bonus);

export default function SpellBookBlock({ creature, canEdit, id }: Props) {
    const [open, setOpen] = useState(false);
    const [level, setLevel] = useState(0);
    const [openId, setOpenId] = useState<number | null>(null);   // the spell shown in the details panel
    const book = useSpellbook(id, open && canEdit);
    const change = useSpellbookChange(id);
    if (!canEdit) return null;

    const known = creature.allSpells;
    const limits = creature.spellLimits;
    const counted = known.filter((s) => !free(s));
    const learnedCantrips = counted.filter((s) => s.base_level === 0).length;
    const learnedSpells = counted.filter((s) => s.base_level >= 1).length;
    const preparedCantrips = counted.filter((s) => s.base_level === 0 && s.is_prepared).length;
    const preparedSpells = known.filter((s) => s.base_level >= 1 && s.is_prepared && !s.is_bonus).length;
    const knownIds = new Set(known.map((s) => Number(s.id)));

    const run = (op: SpellbookOp, spellId: number) => change.mutate({ op, spellId });
    const error = change.error instanceof ApiError || change.error instanceof Error ? change.error.message : null;

    const bookSpells = book.data?.spells ?? [];
    const levels = [...new Set(bookSpells.map((s) => Number(s.base_level)))].sort((a, b) => a - b);
    const shownLevel = levels.includes(level) ? level : (levels[0] ?? 0);
    // A known spell carries its full details; a spell from the open book has what the book sends
    const openSpell = openId == null ? undefined
        : known.find((s) => Number(s.id) === openId) ?? bookSpells.find((s) => Number(s.id) === openId);

    return (
        <section className={styles.block} aria-label="Spell book">
            <div className={styles.restLine}>
                <h2 className={`${styles.heading} ${panelCss.title}`}>Spell book</h2>
                <button type="button" className={styles.button} onClick={() => setOpen(!open)}>{open ? 'Close the book' : 'Learn spells'}</button>
            </div>
            {limits && (
                <span className={styles.muted}>
                    Known {learnedSpells}/{limits.known} · cantrips {learnedCantrips}/{limits.cantrips} · prepared {preparedSpells}/{limits.prepared} · prepared cantrips {preparedCantrips}/{limits.cantrips}
                </span>
            )}
            {error && <p className={styles.error} role="alert">{error}</p>}

            {!open && known.length === 0 && <span className={styles.muted}>No spells learned yet.</span>}
            {!open && known.map((s) => (
                <div key={s.id} className={`${styles.row} ${panelCss.row}`}>
                    <div className={styles.rowText}>
                        <button type="button" className={`${styles.nameButton} ${panelCss.name}`} onClick={() => setOpenId(Number(s.id))}>{s.name}</button>
                        <span className={styles.muted}>
                            {[levelName(s.base_level), s.is_prepared ? 'prepared' : null, s.is_action ? 'action spell' : null,
                              s.is_racial ? 'race starter spell' : s.is_bonus ? 'bonus spell' : null].filter(Boolean).join(' · ')}
                        </span>
                    </div>
                    {!free(s) && (
                        <div className={`${styles.rowButtons} ${panelCss.buttons}`}>
                            <button type="button" className={`${styles.button} ${s.is_prepared ? '' : styles.primary}`} disabled={change.isPending}
                                onClick={() => run(s.is_prepared ? 'unprepare' : 'prepare', s.id)}>{s.is_prepared ? 'Unprepare' : 'Prepare'}</button>
                            <button type="button" className={styles.button} disabled={change.isPending}
                                onClick={() => run(s.is_action ? 'removeAction' : 'setAction', s.id)}>{s.is_action ? 'Remove action' : 'Set action'}</button>
                            <button type="button" className={styles.button} disabled={change.isPending} onClick={() => run('unlearn', s.id)}>Forget</button>
                        </div>
                    )}
                </div>
            ))}

            {open && book.isPending && <span className={styles.muted}>Opening the book…</span>}
            {open && book.error && <p className={styles.error} role="alert">{book.error.message}</p>}
            {open && book.data && (
                <>
                    <nav className={styles.chips} aria-label="Spell levels">
                        {levels.map((l) => (
                            <button key={l} type="button" className={`${styles.chip} ${l === shownLevel ? styles.chipOn : ''}`}
                                aria-pressed={l === shownLevel} onClick={() => setLevel(l)}>{levelName(l)}</button>
                        ))}
                    </nav>
                    {bookSpells.filter((s) => Number(s.base_level) === shownLevel).map((s) => {
                        const learned = knownIds.has(Number(s.id));
                        return (
                            <div key={s.id} className={`${styles.row} ${panelCss.row}`}>
                                <div className={styles.rowText}>
                                    <button type="button" className={`${styles.nameButton} ${panelCss.name}`} onClick={() => setOpenId(Number(s.id))}>{s.name}</button>
                                    <span className={styles.muted}>{[s.alignment_name, s.element_name, s.state_name].filter(Boolean).join(' · ')}</span>
                                </div>
                                <div className={`${styles.rowButtons} ${panelCss.buttons}`}>
                                    <button type="button" className={`${styles.button} ${learned ? '' : styles.primary}`} disabled={change.isPending}
                                        onClick={() => run(learned ? 'unlearn' : 'learn', s.id)}>{learned ? 'Forget' : 'Learn'}</button>
                                </div>
                            </div>
                        );
                    })}
                </>
            )}
            {openSpell && (
                <DetailsPanel title={openSpell.name} onClose={() => setOpenId(null)}>
                    <SpellInfo spell={openSpell} />
                </DetailsPanel>
            )}
        </section>
    );
}
