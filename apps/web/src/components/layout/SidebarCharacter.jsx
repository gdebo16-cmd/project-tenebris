import { Link, useMatch } from 'react-router';
import { FORM_TAB_LIST } from '../character-form/FormTabs.tsx';
import { useSheet } from '../../features/sheets/queries.ts';
import styles from '../../styles/components/layout/Sidebar.module.css';

// The "this character" part of the sidebar. It only shows on a character's own pages:
// /characters/12, /characters/12/edit, /characters/12/inventory
export default function SidebarCharacter() {
    const match = useMatch('/characters/:id/*');
    const id = match?.params.id;
    // Not on a character page, or on /characters/new (no character yet)
    if (!id || !/^\d+$/.test(id)) return null;
    return <CharacterLinks id={id} />;
}

// Only the owner can edit, so other players and the DM don't get these links
function CharacterLinks({ id }) {
    const sheet = useSheet(id);
    if (sheet.data?.access !== 'owner') return null;

    return (
        <>
            <h3 className={styles.characterTitle}>Character Editor</h3>
            {FORM_TAB_LIST.map((tab) => (
                <Link key={tab.id} className={`${styles.sheetLink} ${styles.sheetSubLink}`} to={`/characters/${id}/edit?tab=${tab.id}`}>
                    Edit · {tab.long}
                </Link>
            ))}
            <Link className={styles.link} to={`/characters/${id}/inventory`}>Inventory</Link>
        </>
    );
}