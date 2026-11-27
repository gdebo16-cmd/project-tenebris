import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../api.ts';
import { keys, useCampaigns } from '../../queries.ts';
import Loader from '../../components/ui/Loader';
import styles from '../../styles/features/campaign/CampaignList.module.css';


function CampaignList() {
    const [code, setCode] = useState('');
    const [joinError, setJoinError] = useState('');
    const navigate = useNavigate();

    const { data, isPending, error } = useCampaigns();
    const queryClient = useQueryClient();

    const deleteCampaign = async (e, camp) => {
        e.preventDefault();
        e.stopPropagation();
        if (!window.confirm(`Do you want to delete ${camp.name}? This cannot be undone.`)) return;
        try {
            await api(`/api/campaigns/${camp.id}`, { method: 'DELETE' });
            queryClient.invalidateQueries({ queryKey: keys.campaigns });
            queryClient.invalidateQueries({ queryKey: keys.home });
        } catch (err) {
            alert(`Couldn't delete ${camp.name}: ${err.message}`);
        }
    };

    const joinCampaign = async (e) => {
        e.preventDefault();
        setJoinError('');
        try {
            const { id } = await api('/api/campaigns/join', { method: 'POST', body: { code } });
            queryClient.invalidateQueries({ queryKey: keys.campaigns });
            queryClient.invalidateQueries({ queryKey: keys.home });
            navigate(`/campaign/${id}`);
        } catch (err) {
            setJoinError(err.message);
        }
    };

    if (error) return <p className={styles.page}>Failure is upon us: {error.message}</p>;
    if (isPending) return <Loader className={styles.page} text='Summoning your stories...'/>;

    const { campaigns } = data;

    return (
        <>
            <header id={styles.siteTitle}>
                <img src="/Logo.png" alt="Eldrid Tales Logo" className={styles.titleLogo} />
                <h1>Your Tales</h1>
            </header>
            <main className={styles.page}>
                <section className={styles.clPanel}>
                    <h2 className={styles.clHeader}><strong>Start or Join a Tale</strong></h2>
                    <div className={`${styles.clBody} ${styles.clActions}`}>
                        <Link className={styles.clCreate} to="/create_campaign">Tell a New Tale</Link>
                        <form onSubmit={joinCampaign} className={styles.clJoin}>
                            <input className={styles.field} type="text" placeholder="Invite code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={8} />
                            <button className={styles.clJoinBtn} type="submit">Join</button>
                        </form>
                        {joinError && <p className={styles.clError}>{joinError}</p>}
                    </div>
                </section>
                <section className={styles.clPanel}>
                    <h2 className={styles.clHeader}><strong>Your Tales</strong></h2>
                    <div className={styles.clBody}>
                        {campaigns.length === 0 ? (
                            <p className={styles.clEmpty}>No Tales Yet</p>
                        ) : (
                            <ul className={styles.clList}>
                                {campaigns.map((camp) => (
                                    <li key={camp.id} className={styles.clCard}>
                                        <Link className={styles.clCardLink} to={`/campaign/${camp.id}`}>
                                            {camp.campaign_img_url
                                                ? <img className={styles.clCardImage} src={camp.campaign_img_url} alt="" />
                                                : <div className={styles.clCardImage} aria-hidden="true" />}
                                            <div className={styles.clCardText}>
                                                <h3 className={styles.clCardName}>{camp.name}</h3>
                                                <span className={camp.role === 'dm' ? `${styles.clRole} ${styles.roleDm}` : styles.clRole}>{camp.role === 'dm' ? 'DM' : 'Player'}</span>
                                                <p className={styles.clCardDescription}>{camp.description}</p>
                                            </div>
                                        </Link>
                                        {camp.role === 'dm' && (
                                            <button type="button" className={styles.clDelete} onClick={(e) => deleteCampaign(e, camp)}>Delete</button>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </section>
            </main>
            <footer>
                <p className={styles.footerText}>copyrite Eldrid Tales LLC</p>
            </footer>
        </>
    );
}

export default CampaignList;