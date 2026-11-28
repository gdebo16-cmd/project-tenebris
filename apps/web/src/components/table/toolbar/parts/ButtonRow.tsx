import { type ReactNode } from 'react'
import styles from '../../../../styles/components/table/toolbar/Toolbar.module.css'
import controls from '../../../../styles/components/table/toolbar/TableControls.module.css'
import { ButtonRow as UiButtonRow } from '../../../ui/ButtonRow.tsx'

export function ButtonRow({ label, children, role, className, 'aria-label': ariaLabel }: {
    label?: ReactNode;
    children?: ReactNode;
    role?: string;
    className?: string;
    'aria-label'?: string;
}) {
    return (
        <UiButtonRow className={`${styles.btnRow} ${className}`} label={label} labelClassName={controls.field} role={role} aria-label={ariaLabel}>
            {children}
        </UiButtonRow>
    );
}
