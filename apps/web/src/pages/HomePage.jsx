import { useState } from 'react';
import { Link } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../api.ts';
import { keys, useHome } from '../queries.ts';
import Loader from '../components/Loader';
import styles from './HomePage.module.css';

function HomePage() {
    const { data, isPending, error } = useHome();
    const queryClient = useQueryClient();
    const [homeTab, setHomeTab] = useState('current'); // which section shows on mobile

    // Ask, delete on the server, then refresh every list that showed it.
    // The delete buttons sit inside each card's link, so stop the click from following the link.
    const remove = async (e, question, path, label) => {
        e.preventDefault();
        e.stopPropagation();
        if (!window.confirm(question)) return;
        try {
            await api(path, { method: 'DELETE' });
            queryClient.invalidateQueries({ queryKey: keys.home });
            queryClient.invalidateQueries({ queryKey: keys.campaigns });
        } catch (err) {
            alert(`Couldn't delete ${label}: ${err.message}`);
        }
    };
    const deleteCharacter = (e, ch) => remove(e, `Do you want to delete ${ch.name}? This cannot be undone.`, `/api/characters/${ch.id}`, ch.name);
    const deleteCampaign = (e, camp) => remove(e, `Do you want to delete ${camp.name}? This cannot be undone.`, `/api/campaigns/${camp.id}`, camp.name);
    const deleteDraft = (e, ch) => remove(e, `Delete ${ch.name || 'this unfinished character'}?`, `/api/characters/${ch.id}`, ch.name || 'the unfinished character');

    if (error) return <p className={styles.page}>Failure is upon us: {error.message}</p>;
    if (isPending) return <Loader className={styles.page} text='Summoning your stories...'/>;

    const { username, characters, campaigns, drafts = [] } = data;

    return (
        <>
            <header id={styles.siteTitle}>
                <img src="/Logo.png" alt="Eldrid Tales Logo" className={styles.titleLogo} />
                <h1>Welcome {username}!</h1>
            </header>
            <main className={styles.page}>
                <nav className={styles.homeTabs}>
                    <button type="button" className={homeTab === 'current' ? `${styles.homeTab} ${styles.isActive}` : styles.homeTab} onClick={() => setHomeTab('current')}>Current Characters</button>
                    <button type="button" className={homeTab === 'campaign' ? `${styles.homeTab} ${styles.isActive}` : styles.homeTab} onClick={() => setHomeTab('campaign')}>Current Campaigns</button>
                    <button type="button" className={homeTab === 'unfinished' ? `${styles.homeTab} ${styles.isActive}` : styles.homeTab} onClick={() => setHomeTab('unfinished')}>Unfinished Work</button>
                </nav>
                <section id={styles.currentCharacterContainer} className={homeTab === 'current' ? `${styles.container} ${styles.isActive}` : styles.container}>
                    <article className={styles.title}>
                        <h2 className={styles.titleText}>Current Characters</h2>
                        <Link to="/characters/new">New character</Link>
                    </article>
                    <article id={styles.currentCharacterTile}>
                        {characters.length === 0 ? (
                            <p>No Characters Available</p>
                        ) : (
                            <ul className={styles.tileList}>
                                {characters.map((ch) => (
                                    <li key={ch.id} id={`character-tile-${ch.id}`}>
                                        <Link to={`/characters/${ch.id}`} className={styles.charTile}>
                                            <h3 className={styles.characterName}>{ch.name}</h3>
                                            <img className={styles.characterImage} src={ch.portrait_url ?? '/default-character.png'} alt="Character Image" />
                                            <p className={styles.characterRace}>Race: {ch.race}</p>
                                            <p className={styles.characterClass}>Class: {ch.class}</p>
                                            <p className={styles.characterSubclass}>Sub-class: {ch.subclass}</p>
                                            <button type="button" className={styles.characterDeleteButton} onClick={(e) => deleteCharacter(e, ch)}>Delete</button>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </article>
                </section>
                <section id={styles.currentCampaignContainer} className={homeTab === 'campaign' ? `${styles.container} ${styles.isActive}` : styles.container}>
                    <article className={styles.title}>
                        <h2 className={styles.titleText}>Current Tales</h2>
                    </article>
                    <article id={styles.currentCampaignTile}>
                        {campaigns.length === 0 ? (
                            <p>No Tales to Tell</p>
                        ) : (
                            <ul className={styles.tileList}>
                                {campaigns.map((camp) => (
                                    <li key={camp.id} className={styles.campaignTile} id={`campaign-tile-${camp.id}`}>
                                        <Link to={`/campaign/${camp.id}`} className={styles.campTile}>
                                            <h3 className={styles.campaignName}>{camp.name}</h3>
                                            {camp.campaign_img_url
                                                ? <img className={styles.campaignImage} src={camp.campaign_img_url} alt={`${camp.name} picture`} />
                                                : <div className={styles.campaignImage} role="img" aria-label={`${camp.name} picture`} />}
                                            {camp.description && <p className={styles.campaignDescription}>{camp.description}</p>}
                                            <button type="button" className={styles.campaignDeleteButton} onClick={(e) => deleteCampaign(e, camp)}>Delete</button>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </article>
                    
                </section>
                <section id="unfinished-character-container" className={homeTab === 'unfinished' ? `${styles.container} ${styles.isActive}` : styles.container}>
                    <article className={styles.title}>
                        <h2 className={styles.titleText}>Unfinished Work</h2>
                    </article>
                    <article id={styles.unfinishedCharacterTile}>
                        <ul className={styles.tileList}>
                        {drafts.length === 0 ? (
                            <p>You are all caught up!</p>
                        ) : drafts.map((ch) => (
                            <li key={ch.id} id={`character-tile-${ch.id}`}>
                                <Link to={`/characters/${ch.id}/edit`} className={styles.charTile}>
                                    <h3 className={styles.characterName}>{ch.name || 'One with no name'}</h3>
                                    <img className={styles.characterImage} src={ch.portrait_url ?? '/default-character.png'} alt='Character Image' />
                                    <p className={styles.characterRace}>Race: {ch.race || 'Undecided'}</p>
                                    <p className={styles.characterClass}>Class: {ch.class || 'Undecided'}</p>
                                    <p className={styles.characterSubclass}>Sub-class: {ch.subclass || 'Undecided'}</p>
                                    <button type='button' className={styles.characterDeleteButton} onClick={(e) => deleteDraft(e, ch)}>Delete</button>
                                </Link>
                            </li>
                        ))}
                        </ul>
                    </article>
                </section>
            </main>
            <footer>
                <p className={styles.footerText}>copyrite Eldrid Tales LLC</p>
            </footer>
        </>
    );
}

export default HomePage;
