import { type ButtonHTMLAttributes, type ReactNode } from 'react';

/** Shared button primitive. Visual look comes from className (no default CSS). */
export function Button({ type = 'button', className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { children?: ReactNode }) {
    return <button type={type} className={className} {...rest}>{children}</button>;
}
