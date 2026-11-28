import { type HTMLAttributes, type ReactNode } from 'react';

type Props = { title?: string; className?: string; children: React.ReactNode }

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


