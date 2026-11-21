import { useState } from 'react';
import { Link } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../api.ts';
import { keys, useHome } from '../queries.ts';
import usePageStyle from '../hooks/usePageStyle';
import homeCss from '../styles/home.css?inline';
import SiteNav from '../components/SiteNav';
import Loader from '../components/Loader';

function HomePage() {
    usePageStyle(homeCss);
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

    if (error) return <p>Failure is upon us: {error.message}</p>;
    if (isPending) return <Loader text='Summoning your stories...'/>;

    const { username, characters, campaigns, drafts = [] } = data;

    return (
        <>
            <header id="site-title">
                <img src="/Logo.png" alt="Eldrid Tales Logo" className="title-logo" />
                <h1>Welcome {username}!</h1>
            </header>
            <SiteNav />
            <main>
                <nav className="home-tabs">
                    <button type="button" className={homeTab === 'current' ? 'home-tab is-active' : 'home-tab'} onClick={() => setHomeTab('current')}>Current Characters</button>
                    <button type="button" className={homeTab === 'campaign' ? 'home-tab is-active' : 'home-tab'} onClick={() => setHomeTab('campaign')}>Current Campaigns</button>
                    <button type="button" className={homeTab === 'unfinished' ? 'home-tab is-active' : 'home-tab'} onClick={() => setHomeTab('unfinished')}>Unfinished Work</button>
                </nav>
                <section id="current-character-container" className={homeTab === 'current' ? 'container is-active' : 'container'}>
                    <article className="title" id="current-character-title">
                        <h2 className="title-text">Current Characters</h2>
                        <Link to="/characters/new">New character</Link>
                    </article>
                    <article className="char-list" id="current-character-tile">
                        {characters.length === 0 ? (
                            <p>No Characters Available</p>
                        ) : (
                            <ul className="tile-list" id="current-character-list">
                                {characters.map((ch) => (
                                    <li key={ch.id} className='character-tile' id={`character-tile-${ch.id}`}>
                                        <Link to={`/characters/${ch.id}`} className="char-tile">
                                            <h3 className="character-name">{ch.name}</h3>
                                            <img className="character-image" src={ch.portrait_url ?? '/default-character.png'} alt="Character Image" />
                                            <p className="character-race">Race: {ch.race}</p>
                                            <p className="character-class">Class: {ch.class}</p>
                                            <p className="character-subclass">Sub-class: {ch.subclass}</p>
                                            <button type="button" className="character-delete-button" onClick={(e) => deleteCharacter(e, ch)}>Delete</button>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </article>
                </section>
                <section id="current-campaign-container" className={homeTab === 'campaign' ? 'container is-active' : 'container'}>
                    <article className="title" id="current-campaign-title">
                        <h2 className="title-text">Current Tales</h2>
                    </article>
                    <article className="char-list" id="current-campaign-tile">
                        {campaigns.length === 0 ? (
                            <p>No Tales to Tell</p>
                        ) : (
                            <ul className="tile-list" id="current-campaign-list">
                                {campaigns.map((camp) => (
                                    <li key={camp.id} className='campaign-tile' id={`campaign-tile-${camp.id}`}>
                                        <Link to={`/campaign/${camp.id}`} className='camp-tile'>
                                            <h3 className="campaign-name">{camp.name}</h3>
                                            {camp.campaign_img_url
                                                ? <img className="campaign-image" src={camp.campaign_img_url} alt={`${camp.name} picture`} />
                                                : <div className="campaign-image" role="img" aria-label={`${camp.name} picture`} />}
                                            {camp.description && <p className="campaign-description">{camp.description}</p>}
                                            <button type="button" className="campaign-delete-button" onClick={(e) => deleteCampaign(e, camp)}>Delete</button>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </article>
                    
                </section>
                <section id="unfinished-character-container" className={homeTab === 'unfinished' ? 'container is-active' : 'container'}>
                    <article className="title" id="unfinished-character-title">
                        <h2 className="title-text">Unfinished Work</h2>
                    </article>
                    <article className="char-list" id="unfinished-character-tile">
                        <ul className="tile-list" id="unfinished-character-list">
                        {drafts.length === 0 ? (
                            <p>You are all caught up!</p>
                        ) : drafts.map((ch) => (
                            <li key={ch.id} className='character-tile' id={`character-tile-${ch.id}`}>
                                <Link to={`/characters/${ch.id}/edit`} className='char-tile'>
                                    <h3 className='character-name'>{ch.name || 'One with no name'}</h3>
                                    <img className='character-image' src={ch.portrait_url ?? '/default-character.png'} alt='Character Image' />
                                    <p className='character-race'>Race: {ch.race || 'Undecided'}</p>
                                    <p className='character-class'>Class: {ch.class || 'Undecided'}</p>
                                    <p className='character-subclass'>Sub-class: {ch.subclass || 'Undecided'}</p>
                                    <button type='button' className='character-delete-button' onClick={(e) => deleteDraft(e, ch)}>Delete</button>
                                </Link>
                            </li>
                        ))}
                        </ul>
                    </article>
                </section>
            </main>
            <footer>
                <p className="footer-text" id="footer-text">copyrite Eldrid Tales LLC</p>
            </footer>
        </>
    );
}

export default HomePage;
