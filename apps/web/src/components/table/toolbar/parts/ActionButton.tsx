import { type ReactNode } from 'react'
import styles from '../../../../styles/components/table/toolbar/Toolbar.module.css'
import controls from '../../../../styles/components/table/toolbar/TableControls.module.css'
import { Button } from '../../../ui/Button.tsx'

export function ActionButton({ onClick, children, danger }: { onClick: () => void; children: ReactNode; danger?: boolean }) {
    return (
        <Button className={danger ? `${controls.tool} ${styles.btn} ${styles.toolDanger}` : `${controls.tool} ${styles.btn}`} onClick={onClick}>{children}</Button>
    );
}
