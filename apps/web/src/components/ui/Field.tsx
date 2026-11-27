import { type LabelHTMLAttributes, type ReactNode } from 'react';

/** A labelled field. Visual look comes from className (no default CSS). */
export function Field({ className, label, children, ...rest }: LabelHTMLAttributes<HTMLLabelElement> & { label: ReactNode; children?: ReactNode }) {
    return (
        <label className={className} {...rest}>{label}{' '}{children}</label>
    );
}
