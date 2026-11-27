import { type ReactNode } from 'react'
import styles from '../../../../styles/components/table/toolbar/Toolbar.module.css'
import { Section as UiSection } from '../../../ui/Section.tsx'

export function Section({ id, labelledBy, title, children }: {
    id: string;
    labelledBy?: string;
    title?: ReactNode;
    children?: ReactNode;
}) {
    return (
        <UiSection className={styles.section} role="tabpanel" id={id} aria-labelledby={labelledBy} heading={title} headingClassName={styles.sectionTitle}>
            {children}
        </UiSection>
    );
}
