import { type ReactNode } from 'react'
import styles from '../Toolbar.module.css'
import controls from '../TableControls.module.css'

export function btnClass(on: boolean) {
    return on ? `${controls.tool} ${controls.toolOn} ${styles.btn}` : `${controls.tool} ${styles.btn}`;
}

export function ToggleButton({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: ReactNode }) {
    return (
        <button type="button" className={btnClass(pressed)} aria-pressed={pressed} onClick={onClick}>{children}</button>
    );
}
