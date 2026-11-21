// Inscribe runes on one owned weapon or armor (Rune Weaver), ported from the old sheet's rune control.
// The server enforces item types, prerequisites and the per-item / active limits; this only offers the likely picks.
import { useState } from 'react';
import { runeChoices, type ItemRune, type RuneInfo, type RuneItemType } from '@tenebris/rules/equipment';
import styles from '../Sheet.module.css';

type Props = {
    info: RuneInfo;
    kind: 'weapon' | 'armor';
    itemId: number;
    itemName: string;
    itemType: RuneItemType;
    itemRunes: ItemRune[];
    isRunedWeapon?: boolean;
    busy: boolean;
    onSend: (path: string, body: Record<string, unknown>) => void;
};

export default function RuneControl({ info, kind, itemId, itemName, itemType, itemRunes, isRunedWeapon = false, busy, onSend }: Props) {
    const [runeId, setRuneId] = useState('');
    const [choice, setChoice] = useState('');
    const { options, full } = runeChoices(info, itemType, itemRunes);
    const picked = info.runes.find((r) => String(r.id) === runeId);

    function inscribe() {
        if (!picked) return;
        onSend('runes/inscribe', { kind, item_id: itemId, rune_id: Number(picked.id), ...(choice ? { choice_value: choice } : {}) });
        setRuneId('');
        setChoice('');
    }

    return (
        <div className={styles.options} aria-label={`Runes on ${itemName}`}>
            <span className={styles.muted}>Runes ({itemRunes.length}/{info.perItem} on item, {info.used}/{info.active} active)</span>
            {itemRunes.map((r) => (
                <div key={r.id} className={styles.runeLine} title={r.effect}>
                    <span>{r.name}{r.choice_value ? ` (${r.choice_value})` : ''}</span>
                    <button type="button" className={styles.chip} disabled={busy} onClick={() => onSend('runes/remove', { item_rune_id: r.id })}>Remove</button>
                </div>
            ))}
            {!full && options.length > 0 && (
                <div className={styles.runeLine}>
                    <select className={styles.input} aria-label={`Rune to inscribe on ${itemName}`} value={runeId}
                        onChange={(e) => { setRuneId(e.target.value); setChoice(''); }}>
                        <option value="">Inscribe runes...</option>
                        {options.map((r) => <option key={r.id} value={r.id}>{r.name} (L{r.min_level})</option>)}
                    </select>
                    {picked?.choice_param === 'damage_type' && (
                        <select className={styles.input} aria-label="Damage type" value={choice} onChange={(e) => setChoice(e.target.value)}>
                            <option value="">Damage type...</option>
                            {info.wardingTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                    )}
                    {picked && (
                        <button type="button" className={styles.chip} disabled={busy || (!!picked.choice_param && !choice)} onClick={inscribe}>Inscribe</button>
                    )}
                </div>
            )}
            {picked?.effect && <span className={styles.muted}>{picked.effect}</span>}
            {kind === 'weapon' && itemRunes.length > 0 && (
                <label className={styles.option}>
                    <input type="checkbox" className={styles.optionBox} checked={isRunedWeapon} disabled={busy}
                        onChange={() => onSend('runes/runed-weapon', { weapon_id: isRunedWeapon ? null : itemId })} />
                    Runed weapon (INT, Runic Strike)
                </label>
            )}
        </div>
    );
}
