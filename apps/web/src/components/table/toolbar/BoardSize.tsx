// The Map Editor's board size picker: the sizes come from BOARD_SIZES (rules); the chosen one is saved on the board itself.
import { BOARD_SIZES } from '@tenebris/rules/board'
import styles from '../../../styles/components/table/toolbar/BoardSize.module.css'

export function BoardSize({ value, onChange, error }: { value: number; onChange: (radius: number) => void; error?: string }) {
    return (
        <div className={styles.picker}>
            <label htmlFor="board-radius-select">Board size</label>
            <select id="board-radius-select" className={styles.select} value={value} onChange={(e) => onChange(Number(e.target.value))}>
                {BOARD_SIZES.map((r) => (
                    <option key={r} value={r}>Radius {r}</option>
                ))}
            </select>
            {error && <span className={styles.error} role="alert">{error}</span>}
        </div>
    );
}
