import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../api.ts';
import { keys } from '../queries.ts';
import styles from './JoinCampaign.module.css';


export default function JoinCampaign() {
    const { code } = useParams();
    const [error, setError] = useState('');
    const ran = useRef(false);
    const navigate = useNavigate();
    const queryClient = useQueryClient();



    useEffect(() => {
        if (ran.current) return;
        ran.current = true;

        const join = async () => {
            try {
                const { id } = await api('/api/campaigns/join', { method: 'POST', body: { code } });
                queryClient.invalidateQueries({ queryKey: keys.campaigns });
                queryClient.invalidateQueries({ queryKey: keys.home });
                navigate(`/campaign/${id}`);
            } catch (err) {
                setError(err.message);
            }
        };
        join();
    }, [code]);

    return (
        <>
        <header id={styles.siteTitle}>
            <img src="/Logo.png" alt="Eldrid Tales Logo" className={styles.titleLogo} />
            <h1>Join a Tale</h1>
        </header>
        <main className={styles.page}>
        <div>
        {error ? (
            <>
              <p>{error}</p>
              <Link to="/campaign_list">Back to your Tales</Link>
            </>
        ) : (
            <p>Joining Tale...</p>
        )}
        </div>
        </main>
        <footer>
            <p className={styles.footerText}>copyrite Eldrid Tales LLC</p>
        </footer>
        </>
    );
}