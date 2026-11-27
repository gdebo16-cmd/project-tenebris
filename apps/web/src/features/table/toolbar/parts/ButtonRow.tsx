import { type ReactNode } from 'react'
import styles from '../Toolbar.module.css'
import controls from '../TableControls.module.css'

export function ButtonRow({ label, children, role, 'aria-label': ariaLabel }: {
    label?: ReactNode;
    children?: ReactNode;
    role?: string;
    'aria-label'?: string;
}) {
    return (
        <div className={styles.btnRow} role={role} aria-label={ariaLabel}>
            {label != null && <span className={controls.field}>{label}</span>}
            {children}
        </div>
    );
}
