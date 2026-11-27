import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../../api.ts';
import { keys, useSettings } from '../../../queries.ts';
import styles from '../../../styles/components/layout/settings/Settings.module.css';

// Username, email, password, and deleting the account.
// Waits for the saved username and email, then shows the form filled in with them.
export default function AccountSettings() {
    const settings = useSettings();
    if (settings.isPending) return <p className={styles.heading}>Loading account…</p>;
    if (settings.error) return <p role="alert">{settings.error.message}</p>;
    return <AccountForm saved={settings.data} />;
}

function AccountForm({ saved }) {
    // Starts from what the server has; no effect needed
    const [form, setForm] = useState({ username: saved.username, email: saved.email, password: '' });
    const [message, setMessage] = useState('');
    const queryClient = useQueryClient();

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
        <section className={styles.group} aria-label="Account">
            <h3 className={styles.title}>Account</h3>
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
            <button className={styles.profileButton} type="button" onClick={deleteAccount}>Delete Profile</button>
        </section>
    );
}