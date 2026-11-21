import { Link, useLocation } from 'react-router';
import LogoutLink from './LogoutLink';
import useTabSlider from '../hooks/useTabSlider';
import styles from './SiteNav.module.css';

// which tab matches the current page
function activeIndex(path) {
    if (path.startsWith('/home')) return 0;
    if (['/characters/new', '/create_campaign', '/campaign_list'].some((p) => path.startsWith(p))) return 1;
    if (['/profile', '/settings'].some((p) => path.startsWith(p))) return 2;
    return -1;
}

// The menu on the home and settings pages (same links as home.ejs).
// className lands on the <nav>, so a page can adjust the menu from its own CSS module.
function SiteNav({ className }) {
    const { pathname } = useLocation();
    const { tabProps, barProps, slideStyle } = useTabSlider(activeIndex(pathname));

    return (
        <nav className={className ? `${styles.navBox} ${className}` : styles.navBox}>
            <ul className={styles.navContainer} {...barProps}>
                <li className={styles.slide} aria-hidden="true" style={slideStyle} />
                <Link className={styles.homeNav} to="/home" {...tabProps(0)}>home</Link>

                <li className={styles.characterNav} {...tabProps(1)}>Adventures
                    <ul className={styles.dropDown}>
                        <Link className={styles.btnDropCharacter} to="/characters/new">Create Character</Link>
                        <Link className={styles.btnDropCharacter} to="/create_campaign">Create Tale</Link>
                        <Link className={styles.btnDropCharacter} to="/campaign_list">Tale List</Link>
                    </ul>
                </li>
                <li className={styles.settingsNav} {...tabProps(2)}>Settings
                    <ul className={styles.dropDown}>
                        <Link className={styles.btnDropSettings} to="/profile">Profile</Link>
                        <Link className={styles.btnDropSettings} to="/settings">Settings</Link>
                        <LogoutLink className={styles.btnDropSettings} />
                    </ul>
                </li>
            </ul>
        </nav>
    );
}

export default SiteNav;
