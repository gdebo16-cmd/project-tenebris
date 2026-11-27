import { type HTMLAttributes, type ReactNode } from 'react';

/** A titled section. Visual look comes from className props (no default CSS). */
export function Section({
    className,
    heading,
    headingClassName,
    children,
    ...rest
}: HTMLAttributes<HTMLDivElement> & { heading?: ReactNode; headingClassName?: string; children?: ReactNode }) {
    return (
        <div className={className} {...rest}>
            {heading != null && <h3 className={headingClassName}>{heading}</h3>}
            {children}
        </div>
    );
}
