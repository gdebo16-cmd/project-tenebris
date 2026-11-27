// Spell slots and the prepared action spells. Cast asks the server to spend a slot at the level picked and
// roll what the spell does (to hit, the target's save, damage or healing), all in one trip.
import { useState } from 'react';
import { signed } from '@tenebris/rules/math';
import { spellDiceAt, spellHealAt, type SpellAction } from '@tenebris/rules/creature';
import { statName } from '@tenebris/rules/stats';
import styles from '../../../styles/components/sheets/blocks/SpellsBlock.module.css';
import panelCss from '../../../styles/components/sheets/blocks/ActionPanel.module.css';
import type { BlockProps } from '../../../features/sheets/types.ts';
import DetailsPanel from './DetailsPanel.tsx';
import { SpellInfo } from './details.tsx';

type Props = BlockProps & { onCast: (actionKey: string, castLevel: number) => void };

export default function SpellsBlock({ creature, canEdit, onAct, onCast }: Props) {
    const { slots, usedSlots } = creature.spellcasting;
    const [castLevels, setCastLevels] = useState<Record<string, number>>({});
    const [openKey, setOpenKey] = useState<string | null>(null);   // the spell shown in the details panel
    const left = (level: number) => (slots[level - 1] ?? 0) - (usedSlots[level] ?? 0);

    // The levels this spell may be cast at: its own level up to the highest slot level that still has a slot
    const levelsFor = (s: SpellAction) => {
        if (s.base_level < 1 || !(s.upcasts ?? []).length) return [];
        const out: number[] = [];
        for (let level = s.base_level; level <= slots.length; level++) if (left(level) > 0) out.push(level);
        return out;
    };

    const openSpell = creature.spells.find((s) => s.key === openKey);

    return (
        <section className={styles.block} aria-label="Spells">
            <h2 className={`${styles.heading} ${panelCss.title}`}>Spells · to hit {signed(creature.spellcasting.toHit)} · save DC {creature.spellcasting.saveDc}</h2>
            {slots.map((total, i) => (
                <div key={i} className={styles.slots} aria-label={`Level ${i + 1} slots: ${total - (usedSlots[i + 1] ?? 0)} of ${total} left`}>
                    <span className={styles.muted}>Level {i + 1}</span>
                    {Array.from({ length: total }, (_, j) => (
                        <span key={j} className={`${styles.slot} ${j < total - (usedSlots[i + 1] ?? 0) ? styles.slotFull : ''}`} />
                    ))}
                </div>
            ))}
            {creature.spells.length === 0 && <span className={styles.muted}>No prepared action spells.</span>}
            {creature.spells.map((s) => {
                const level = castLevels[s.key] ?? s.base_level;
                const dice = spellDiceAt(s, level);
                const heal = spellHealAt(s, level);
                const levels = levelsFor(s);
                return (
                    <div key={s.key} className={`${styles.row} ${panelCss.row}`}>
                        <div className={styles.rowText}>
                            <button type="button" className={`${styles.nameButton} ${panelCss.name}`} onClick={() => setOpenKey(s.key)}>{s.name}</button>
                            <span className={styles.muted}>
                                {[s.base_level === 0 ? 'Cantrip' : `Level ${s.base_level}`, s.tile !== 'action' ? s.tile : null,
                                  s.attack_type ? `to hit ${signed(s.toHit)}` : null, s.opponent_save_roll ? `${statName(s.opponent_save_roll)} save ${s.saveDc}` : null,
                                  dice ? `${dice}${s.beams > 1 ? ` ×${s.beams} beams` : ''}` : heal ? `heals ${heal}${s.healMod ? signed(s.healMod) : ''}` : null].filter(Boolean).join(' · ')}
                            </span>
                        </div>
                        <div className={`${styles.rowButtons} ${panelCss.buttons}`}>
                            {levels.length > 1 && (
                                <select className={styles.input} aria-label={`${s.name} cast level`} value={level}
                                    onChange={(e) => setCastLevels({ ...castLevels, [s.key]: Number(e.target.value) })}>
                                    {levels.map((l) => <option key={l} value={l}>Level {l}</option>)}
                                </select>
                            )}
                            <button type="button" className={`${styles.button} ${styles.primary}`} disabled={!canEdit} onClick={() => onCast(s.key, level)}>Cast</button>
                            {s.attack_type && dice && (
                                <button type="button" className={styles.button} disabled={!canEdit} aria-label={`${s.name} damage`}
                                    onClick={() => onAct({ actionKey: s.key, kind: 'damage', castLevel: level }, `${s.name}: `)}>{dice}</button>
                            )}
                        </div>
                    </div>
                );
            })}
            {openSpell && (
                <DetailsPanel title={openSpell.name} onClose={() => setOpenKey(null)}>
                    <SpellInfo spell={openSpell} numbers={{ toHit: openSpell.toHit, saveDc: openSpell.saveDc, tile: openSpell.tile }} />
                </DetailsPanel>
            )}
        </section>
    );
}
