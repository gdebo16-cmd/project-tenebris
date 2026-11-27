import { type ReactNode } from 'react'
import controls from '../../../../styles/components/table/toolbar/TableControls.module.css'
import { Field as UiField } from '../../../ui/Field.tsx'

export function Field({ label, children }: { label: ReactNode; children?: ReactNode }) {
    return (
        <UiField className={controls.field} label={label}>{children}</UiField>
    );
}
