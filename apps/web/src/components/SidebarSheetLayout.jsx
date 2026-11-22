import { useMatch } from 'react-router';
import { isWideScreen, requestLayoutEdit } from '../features/sheet/layoutEvents.ts';
import styles from './Sidebar.module.css';

// "Edit sheet layout": only on a sheet (a character's or a monster's), and only on a wide screen,
// where layouts are arranged. It asks the sheet to start arranging, then closes the sidebar.
export default function SidebarSheetLayout({ onDone }) {
    const character = useMatch('/characters/:id');
    const monster = useMatch('/monsters/:id');
    const id = (character ?? monster)?.params.id;
    if (!id || !/^\d+$/.test(id) || !isWideScreen()) return null;

    return (
        <button type="button" className={styles.link} onClick={() => { onDone(); requestLayoutEdit(); }}>
            Edit sheet layout
        </button>
    );
}
