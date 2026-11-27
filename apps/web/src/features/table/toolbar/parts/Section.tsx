import { type ReactNode } from 'react'
import styles from '../Toolbar.module.css'

export function Section({ id, labelledBy, title, children }: {
    id: string;
    labelledBy?: string;
    title?: ReactNode;
    children?: ReactNode;
}) {
    return (
        <div className={styles.section} role="tabpanel" id={id} aria-labelledby={labelledBy}>
            {title != null && <h3 className={styles.sectionTitle}>{title}</h3>}
            {children}
        </div>
    );
}
