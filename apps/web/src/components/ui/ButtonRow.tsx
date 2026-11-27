import { type HTMLAttributes, type ReactNode } from 'react';

/** A labelled row of controls. Visual look comes from className props (no default CSS). */
export function ButtonRow({
    className,
    label,
    labelClassName,
    children,
    ...rest
}: HTMLAttributes<HTMLDivElement> & { label?: ReactNode; labelClassName?: string; children?: ReactNode }) {
    return (
        <div className={className} {...rest}>
            {label != null && <span className={labelClassName}>{label}</span>}
            {children}
        </div>
    );
}
