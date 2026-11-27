import { type ReactNode } from 'react'
import styles from '../Toolbar.module.css'
import controls from '../TableControls.module.css'

export function ActionButton({ onClick, children, danger }: { onClick: () => void; children: ReactNode; danger?: boolean }) {
    return (
        <button type="button" className={danger ? `${controls.tool} ${styles.btn} ${styles.toolDanger}` : `${controls.tool} ${styles.btn}`} onClick={onClick}>{children}</button>
    );
}
