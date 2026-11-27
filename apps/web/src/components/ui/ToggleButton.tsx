import { type ButtonHTMLAttributes, type ReactNode } from 'react';

/** Pressed/unpressed button. Visual look comes from className (no default CSS). */
export function ToggleButton({
    pressed,
    className,
    children,
    type = 'button',
    ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { pressed: boolean; children?: ReactNode }) {
    return (
        <button type={type} className={className} aria-pressed={pressed} {...rest}>{children}</button>
    );
}
