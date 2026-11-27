import { type ReactNode } from 'react'
import controls from '../TableControls.module.css'

export function Field({ label, children }: { label: ReactNode; children?: ReactNode }) {
    return (
        <label className={controls.field}>{label}{' '}{children}</label>
    );
}
