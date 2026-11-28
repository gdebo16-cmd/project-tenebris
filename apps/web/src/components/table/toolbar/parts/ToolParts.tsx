
import { BRUSHES } from '../../../../features/table/hooks/tableTypes.ts'
import { ToggleButton } from './ToggleButton.tsx'
import { ButtonRow } from './ButtonRow.tsx'
import styles from '../../../../styles/components/table/toolbar/Toolbar.module.css'

export const titled = (word: string) => word[0].toUpperCase() + word.slice(1);

export function BrushRow({ brush, setBrush }: { brush: number; setBrush: (b: number) => void }) {
    return (
        <section className={styles.brushRow}>
            <label className={styles.brushLabel}>Brush Size:</label>
            <ButtonRow>
                {BRUSHES.map(([label, rings]) => (
                    <ul className={styles.toolButtonList}>
                        <li className={styles.toolButton}>    
                            <ToggleButton key={rings} pressed={brush === rings} onClick={() => setBrush(rings)}>{label}</ToggleButton>
                        </li>
                    </ul>
                ))}
            </ButtonRow>
        </section>
    );
}