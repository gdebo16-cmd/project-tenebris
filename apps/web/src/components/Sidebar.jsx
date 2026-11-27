import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router';
import LogoutLink from './LogoutLink';
import LookSettings from './settings/LookSettings';
import GraphicsSettings from './settings/GraphicsSettings';
import AccountSettings from './settings/AccountSettings';
import styles from './Sidebar.module.css';
import SidebarCharacter from './SidebarCharacter';
import SidebarCampaign from './SidebarCampaign';
import SidebarSheetLayout from './SidebarSheetLayout';

// The site menu: a hamburger button that opens a side panel.
// Two views in the same panel: the menu (Home, Adventures, Settings, Log Out) and Settings (look + account).
export default function Sidebar() {
    const dialog = useRef(null);
    const [view, setView] = useState('menu');
    const { pathname } = useLocation();
    const location = useLocation();

    const open = () => { setView('menu'); dialog.current.showModal(); };
    const close = () => dialog.current?.close();

    // Following a link changes the page: close the panel
    useEffect(() => { close(); }, [pathname]);

    // A click on the dimmed area outside the panel closes it
    // (inside the panel, the click lands on .inner or its children, never on the <dialog> itself)
    const onDialogClick = (e) => { if (e.target === dialog.current) close(); };

    useEffect(() => { close(); }, [location.key]);

    return (
        <>
            <button type="button" className={styles.hamburger} aria-label="Open menu" aria-haspopup="dialog" onClick={open}>
                <span /><span /><span />
            </button>

            <dialog ref={dialog} className={styles.panel} aria-label="Menu" onClick={onDialogClick}>
                
                <div className={styles.inner}>
                    
                    <div className={styles.top}>
                        <div className={styles.titleContainer}>
                                {view === 'settings' && (
                                <button type="button" className={styles.backButton} onClick={() => setView('menu')}>‹ Back</button>  
                            )} 
                            <h2 className={styles.title}>{view === 'menu' ? 'Menu' : 'Settings'}</h2>
                            <button type="button" className={styles.iconButton} aria-label="Close menu" onClick={close}>×</button> 
                        </div>
                    </div>

                    {view === 'menu' ? (
                        <nav className={styles.links}>
                            <Link className={styles.homeLink} to="/home" onClick={close}>Home</Link>
                            <button type="button" className={styles.settingsLink} onClick={() => setView('settings')}>Settings ›</button>
                            <LogoutLink className={styles.logoutLink} />
                            <SidebarCharacter />
                            <SidebarCampaign />
                            <SidebarSheetLayout onDone={close} />
                            <h3 className={styles.group}>Adventures</h3>
                                <Link className={styles.createCharacterLink} to="/characters/new">Create Character</Link>
                                <Link className={styles.createTaleLink} to="/create_campaign">Create Tale</Link>
                                <Link className={styles.taleListLink} to="/campaign_list">Tale List</Link>

                        </nav>
                    ) : (
                        <div className={styles.settings}>
                            <LookSettings />
                            <GraphicsSettings />
                            <AccountSettings />
                        </div>
                    )}
                </div>
            </dialog>
        </>
    );
}