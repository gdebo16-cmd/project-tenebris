// The purse: each coin as a number next to its symbol (copper, silver, gold, crowns, oracles), all on one row.
// Owner or DM: the button next to the coins opens a panel with one box per coin, and Add / Spend.
// The server does the sums (coins never change into each other); on success the panel closes,
// on an error (e.g. "Not enough silver.") it stays open and shows the message.
import { useState } from 'react';
import { COINS, type Coin } from '@tenebris/rules/money';
import { ApiError } from '../../../api.ts';
import styles from '../Sheet.module.css';
import { useMoney } from '../queries.ts';
import type { BlockProps } from './types.ts';

type Props = Pick<BlockProps, 'creature' | 'canEdit'> & { id: string; onNote: (text: string) => void };

const NAMES: Record<Coin, string> = { copper: 'Copper', silver: 'Silver', gold: 'Gold', crowns: 'Crowns', oracles: 'Oracles' };
const COIN_CLASS: Record<Coin, string> = {
    copper: styles.coinCopper, silver: styles.coinSilver, gold: styles.coinGold, crowns: styles.coinCrowns, oracles: styles.coinOracles,
};
const EMPTY: Record<Coin, string> = { copper: '', silver: '', gold: '', crowns: '', oracles: '' };

// A small round coin. Real coin art can replace these later.
function CoinSymbol({ coin }: { coin: Coin }) {
    return <span className={`${styles.coin} ${COIN_CLASS[coin]}`} role="img" aria-label={NAMES[coin]} title={NAMES[coin]} />;
}

export default function PurseBlock({ creature, canEdit, id, onNote }: Props) {
    const money = useMoney(id);
    const [open, setOpen] = useState(false);
    const [amounts, setAmounts] = useState(EMPTY);
    const [error, setError] = useState('');
    const purse = creature.purse;

    // Whole numbers only; an empty box is 0
    const numbers = Object.fromEntries(COINS.map((c) => [c, amounts[c] === '' ? 0 : Number(amounts[c])])) as Record<Coin, number>;
    const valid = COINS.every((c) => Number.isInteger(numbers[c]) && numbers[c] >= 0);
    const any = COINS.some((c) => numbers[c] > 0);

    async function send(action: 'add' | 'spend') {
        setError('');
        try {
            await money.mutateAsync({ action, ...numbers });
            const moved = COINS.filter((c) => numbers[c] > 0).map((c) => `${numbers[c]} ${c}`).join(', ');
            onNote(`${creature.name} ${action === 'add' ? 'gains' : 'spends'} ${moved}`);
            setAmounts(EMPTY);
            setOpen(false);
        } catch (err) {
            setError(err instanceof ApiError || err instanceof Error ? err.message : 'Something went wrong');
        }
    }

    function toggle() {
        setOpen(!open);
        setError('');
    }

    return (
        <section className={styles.block} aria-label="Purse">
            <div className={styles.purseLine}>
                <h2 className={styles.heading}>Purse</h2>
                <div className={styles.coins}>
                    {COINS.map((c) => (
                        <span key={c} className={styles.coinAmount} aria-label={`${purse[c]} ${NAMES[c]}`}>
                            <span aria-hidden="true">{purse[c]}</span>
                            <CoinSymbol coin={c} />
                        </span>
                    ))}
                </div>
                {canEdit && (
                    <button type="button" className={styles.chip} aria-expanded={open} aria-controls="purse-panel" onClick={toggle}>
                        {open ? 'Close' : 'Coins ▾'}
                    </button>
                )}
            </div>
            {canEdit && open && (
                <div id="purse-panel" className={styles.pursePanel}>
                    <div className={styles.purseInputs}>
                        {COINS.map((c) => (
                            <label key={c} className={styles.purseField}>
                                <CoinSymbol coin={c} />
                                <input className={`${styles.input} ${styles.coinInput}`} type="number" min={0} step={1} inputMode="numeric"
                                    aria-label={`${NAMES[c]} amount`} placeholder="0" value={amounts[c]}
                                    onChange={(e) => setAmounts({ ...amounts, [c]: e.target.value })} />
                            </label>
                        ))}
                    </div>
                    <div className={styles.rowButtons}>
                        <button type="button" className={`${styles.button} ${styles.heal}`} disabled={money.isPending || !valid || !any} onClick={() => send('add')}>Add</button>
                        <button type="button" className={`${styles.button} ${styles.damage}`} disabled={money.isPending || !valid || !any} onClick={() => send('spend')}>Spend</button>
                    </div>
                    {!valid && <p className={styles.error} role="alert">Whole numbers, 0 or more.</p>}
                    {error && <p className={styles.error} role="alert">{error}</p>}
                </div>
            )}
        </section>
    );
}
