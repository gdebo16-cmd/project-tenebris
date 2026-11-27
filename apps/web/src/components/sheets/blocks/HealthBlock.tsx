// HP / max, temp HP, a health bar, and Damage / Heal / Ward with an amount (only when you may edit).
import { useState } from 'react';
import styles from '../../../styles/components/sheets/blocks/HealthBlock.module.css';
import type { BlockProps } from '../../../features/sheets/types.ts';

type Props = Pick<BlockProps, 'creature' | 'canEdit'> & {
    onHp: (action: 'heal' | 'damage', amount: number) => void;
    onWard: (amount: number) => void;
    error?: string;
};

export default function HealthBlock({ creature, canEdit, onHp, onWard, error }: Props) {
    const [amount, setAmount] = useState('');
    const { current, max, temp } = creature.hp;
    const percent = max > 0 ? Math.max(0, Math.min(100, Math.round((current / max) * 100))) : 0;
    // Green above half, amber above a quarter, red below
    const color = percent > 50 ? '#5c9a52' : percent > 25 ? '#d9a13b' : '#c4553f';
    const n = Number(amount);
    const valid = Number.isInteger(n) && n > 0;

    function apply(action: 'heal' | 'damage' | 'ward') {
        if (!valid) return;
        if (action === 'ward') onWard(n);
        else onHp(action, n);
        setAmount('');
    }

    return (
        <section className={styles.block} aria-label="Health">
            <div className={styles.healthblockTitle}>
                <h2 className={styles.titleHealth}>Health</h2>
                <span className={styles.hpValue}>
                    {current} <span className={styles.muted}>/ {max}</span>
                    {temp > 0 && <span className={styles.muted}> +{temp} ward</span>}
                </span>
            </div>
            <div className={styles.bar} role="meter" aria-valuemin={0} aria-valuemax={max} aria-valuenow={current} aria-label="Health">
                <div className={styles.barFill} style={{ width: `${percent}%`, background: color }} />
            </div>
            {canEdit && (
                <div className={styles.hpControls}>
                    <label className={styles.amount}>
                        Amount
                        <input className={styles.input} type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} />
                    </label>
                    <button type="button" className={`${styles.button} ${styles.damage}`} disabled={!valid} onClick={() => apply('damage')}>Damage</button>
                    <button type="button" className={`${styles.button} ${styles.heal}`} disabled={!valid} onClick={() => apply('heal')}>Heal</button>
                    <button type="button" className={`${styles.button} ${styles.ward}`} disabled={!valid} onClick={() => apply('ward')}>Ward</button>
                </div>
            )}
            {error && <p className={styles.error} role="alert">{error}</p>}
        </section>
    );
}
