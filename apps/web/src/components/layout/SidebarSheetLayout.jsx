import { useMatch } from 'react-router';
import { requestLayoutEdit } from '../../features/sheets/layoutEvents.ts';
import styles from '../../styles/components/layout/Sidebar.module.css';

// "Edit sheet layout": only on a sheet (a character's, a monster's, or the DM page). On a wide screen it arranges the
// desktop layout, on a phone the mobile one (the editor can switch between them). It asks the sheet to start, then closes the sidebar.
export default function SidebarSheetLayout({ onDone }) {
    const character = useMatch('/characters/:id');
    const monster = useMatch('/monsters/:id');
    const dmPage = useMatch('/campaign/:id/dm');   // the DM page is laid out like a sheet too
    const id = (character ?? monster ?? dmPage)?.params.id;
    if (!id || !/^\d+$/.test(id)) return null;

    return (
        <button type="button" className={styles.link} onClick={() => { onDone(); requestLayoutEdit(); }}>
            Edit sheet layout
        </button>
    );
}
