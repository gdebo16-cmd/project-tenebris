import { useState} from 'react';
import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../api.ts';
import { keys } from '../../queries.ts';

import styles from '../../styles/features/campaign/CreateCampaign.module.css';


function CreateCampaign() {
    const navigate = useNavigate();
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [saveError, setSaveError] = useState('');
    const queryClient = useQueryClient();


    const submit = async (e) => {
        e.preventDefault();
        try {
            const { id } = await api('/api/campaigns', { method: 'POST', body: { name, description } });
            queryClient.invalidateQueries({ queryKey: keys.campaigns });
            queryClient.invalidateQueries({ queryKey: keys.home });
            navigate(`/campaign/${id}`);
        } catch (err) {
            setSaveError(err.message);
        }
    };


    return (
        <>
            <header id={styles.siteTitle}>
                <img src="/icons/Logo.png" alt="Eldrid Tales Logo" className={styles.titleLogo} />
                <h1>Create Tale</h1>
            </header>
            <main className={styles.page}>
                <section className={styles.campaignContainer}>
                    <form onSubmit={submit}>
                        <article className={styles.campaignTile}>
                            <label className={styles.campaignLabel} htmlFor="name">Tale Name</label>
                            <input className={styles.campaignValue} type="text" id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="A tale in the making" />
                        </article>
                        <article className={styles.campaignTile}>
                            <label className={styles.campaignLabel} htmlFor="description">Description</label>
                            <textarea className={styles.campaignValue} id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="A brief description of the campaign" />
                        </article>
                        <article className={styles.campaignTile}>
                            <button type="submit" className={styles.campaignButton}>Create Tale</button>
                        </article>
                        {saveError && <p>{saveError}</p>}
                    </form>
                </section>
            </main>
            <footer>
                <p className={styles.footerText}>copyrite Eldrid Tales LLC</p>
            </footer>
        </>     
    );
}

export default CreateCampaign;