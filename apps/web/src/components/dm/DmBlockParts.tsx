import { useState } from 'react';
import { ApiError } from '../../api.ts';
import sheet from '../../styles/components/sheets/Sheet.module.css';
import styles from '../../styles/features/dm/DmPage.module.css';

const messageOf = (err: unknown) => (err instanceof ApiError || err instanceof Error ? err.message : 'Something went wrong');

export function ErrorLine({ errors }: { errors: unknown[] }) {
    const error = errors.find(Boolean);
    return error ? <p className={sheet.error} role="alert">{messageOf(error)}</p> : null;
}

// HP bar colors match the sheet's Health block
export function HpBar({ current, max, label }: { current: number; max: number; label: string }) {
    const percent = max > 0 ? Math.max(0, Math.min(100, Math.round((current / max) * 100))) : 0;
    const color = percent > 50 ? '#5c9a52' : percent > 25 ? '#d9a13b' : '#c4553f';
    return (
        <div className={sheet.bar} role="meter" aria-valuemin={0} aria-valuemax={max} aria-valuenow={current} aria-label={label}>
            <div className={sheet.barFill} style={{ width: `${percent}%`, background: color }} />
        </div>
    );
}

// An amount, then Damage or Heal
export function QuickHp({ name, onHp }: { name: string; onHp: (action: 'heal' | 'damage', amount: number) => void }) {
    const [amount, setAmount] = useState('');
    const n = Number(amount);
    const valid = Number.isInteger(n) && n > 0;
    const apply = (action: 'heal' | 'damage') => { if (valid) { onHp(action, n); setAmount(''); } };
    return (
        <div className={styles.quick}>
            <input className={`${sheet.input} ${styles.quickInput}`} type="number" min={1} value={amount} aria-label={`Amount for ${name}`}
                onChange={(e) => setAmount(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') apply('damage'); }} />
            <button type="button" className={`${sheet.button} ${sheet.damage}`} disabled={!valid} aria-label={`Damage ${name}`} onClick={() => apply('damage')}>−</button>
            <button type="button" className={`${sheet.button} ${sheet.heal}`} disabled={!valid} aria-label={`Heal ${name}`} onClick={() => apply('heal')}>+</button>
        </div>
    );
}

export function Conditions({ list }: { list: string[] }) {
    if (list.length === 0) return null;
    return <div className={sheet.chips}>{list.map((c) => <span key={c} className={`${sheet.chip} ${sheet.chipOn}`}>{c}</span>)}</div>;
}

// "Show": make this creature the current one (pressed when it is)
export function ShowButton({ name, current, onShow }: { name: string; current: boolean; onShow: () => void }) {
    return (
        <button type="button" className={current ? `${styles.show} ${styles.showOn}` : styles.show} aria-pressed={current}
            aria-label={`Show ${name} in the current blocks`} onClick={onShow}>{current ? 'Shown' : 'Show'}</button>
    );
}
