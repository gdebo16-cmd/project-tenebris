import { useEffect, useState } from 'react';
import SiteNav from '../components/SiteNav';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../api.ts';
import { keys, useSettings } from '../queries.ts';
import styles from './SettingsPage.module.css';

// Replaces views/settings.ejs
function SettingsPage() {
    const [form, setForm] = useState({ username: '', email: '', password: '' });
    const [message, setMessage] = useState('');
    const queryClient = useQueryClient();
    const settings = useSettings();

    // fill the form with the current username and email once they arrive
    useEffect(() => {
        if (settings.data) setForm({ username: settings.data.username, email: settings.data.email, password: '' });
    }, [settings.data]);

    const update = (e) => setForm({ ...form, [e.target.name]: e.target.value });

    const submit = async (e) => {
        e.preventDefault();
        try {
            await api('/api/settings', { method: 'PUT', body: form });
            queryClient.invalidateQueries({ queryKey: keys.settings });
            queryClient.invalidateQueries({ queryKey: keys.me }); // the username may have changed
            setForm({ ...form, password: '' }); // clear the password box, like the page reload did
            setMessage('Account updated');
        } catch (err) {
            setMessage(err.message);
        }
    };

    // the browser's confirm popup has to say OK before anything is deleted
    const deleteAccount = async () => {
        const ok = window.confirm('Delete your profile? This permanently removes your account, characters and campaigns. This cannot be undone.');
        if (!ok) return;
        try {
            await api('/api/settings', { method: 'DELETE' });
            queryClient.clear();
            window.location.href = '/'; // full reload so the app forgets the old login
        } catch (err) {
            setMessage(err.message);
        }
    };

    return (
        <>
            <header id={styles.siteTitle}>
                <img src="/Logo.png" alt="Eldrid Tales Logo" className={styles.titleLogo} />
                <h1>Account Settings</h1>
            </header>
            <SiteNav />
            <main className={styles.page}>
                <section className={styles.profileContainer}>
                    <form onSubmit={submit}>
                        <article className={styles.profileTile}>
                            <label className={styles.profileLabel} htmlFor="username">Username</label>
                            <input className={styles.profileValue} type="text" id="username" name="username" value={form.username} onChange={update} />
                        </article>

                        <article className={styles.profileTile}>
                            <label className={styles.profileLabel} htmlFor="email">Email</label>
                            <input className={styles.profileValue} type="email" id="email" name="email" value={form.email} onChange={update} />
                        </article>

                        <article className={styles.profileTile}>
                            <label className={styles.profileLabel} htmlFor="password">Password</label>
                            <input className={styles.profileValue} type="password" id="password" name="password" value={form.password} onChange={update} />
                        </article>

                        {message && <p>{message}</p>}

                        <article className={styles.profileTile}>
                            <button className={styles.profileButton} type="submit">Update Account</button>
                        </article>
                    </form>

                    <article className={styles.profileTile}>
                        <button className={styles.profileButton} type="button" onClick={deleteAccount}>Delete Profile</button>
                    </article>
                </section>
            </main>
            <footer>
                <p className={styles.footerText}>copyrite Eldrid Tales LLC</p>
            </footer>
        </>
    );
}

export default SettingsPage;
