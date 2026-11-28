import { type ReactNode } from 'react'
import styles from '../../../../styles/components/table/toolbar/Toolbar.module.css'
import controls from '../../../../styles/components/table/toolbar/TableControls.module.css'
import { ToggleButton as UiToggleButton } from '../../../ui/ToggleButton.tsx'

export function btnClass(on: boolean) {
    return on ? `${controls.tool} ${controls.toolOn} ${styles.btn}` : `${controls.tool} ${styles.btn}`;
}

export function ToggleButton({ pressed, onClick, children, className }: { pressed: boolean; onClick: () => void; children: ReactNode; className?: string }) {
    return (
        <UiToggleButton pressed={pressed} className={`${btnClass(pressed)} ${className}`} onClick={onClick}>{children}</UiToggleButton>
    );
}
