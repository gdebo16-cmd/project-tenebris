import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../api.ts';
import { keys } from '../queries.ts';
import styles from './RegisterPage.module.css';

// Replaces Public/registration.html
function RegisterPage() {
    const navigate = useNavigate();
    // one state object for the whole form
    const [form, setForm] = useState({ username: '', password: '', email: '', name: '' });
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false); // blocks a second submit while the first is still running
    const queryClient = useQueryClient();

    const update = (e) => setForm({ ...form, [e.target.name]: e.target.value });

    const submit = async (e) => {
        e.preventDefault();
        if (busy) return;
        setBusy(true);
        try {
            const me = await api('/api/register', { method: 'POST', body: form });
            queryClient.clear();
            queryClient.setQueryData(keys.me, me);
            navigate('/home');
        } catch (err) {
            setError(err.message);
            setBusy(false);
        }
    };

    return (
        <>
            <header id={styles.siteTitle}>
                <img src="/Logo.png" alt="Eldrid Tales Logo" className={styles.titleLogo} />
                <h1>Eldrid Tales</h1>
            </header>

            <main className={styles.page}>
                <section className={styles.formContainer}>
                    <article className={styles.formTitle}>
                        <h2>Create Your Legend</h2>
                    </article>
                    <form onSubmit={submit}>
                        <article className={styles.userNameContainer}>
                            <label className={styles.signinLabel} htmlFor="userName">Username</label>
                            <input className={styles.signinValue} type="text" name="username" value={form.username} onChange={update} required />
                        </article>

                        <article className={styles.passwordContainer}>
                            <label className={styles.signinLabel} htmlFor="password">Password</label>
                            <input className={styles.signinValue} type="password" name="password" value={form.password} onChange={update} required />
                        </article>

                        <article className={styles.emailContainer}>
                            <label className={styles.signinLabel} htmlFor="email">Email</label>
                            <input className={styles.signinValue} type="email" name="email" value={form.email} onChange={update} />
                        </article>

                        <article className={styles.nameContainer}>
                            <label className={styles.signinLabel} htmlFor="name">Display Name</label>
                            <input className={styles.signinValue} type="text" name="name" value={form.name} onChange={update} />
                        </article>
        
                        {error && <p>{error}</p>}

                        <article className={styles.buttonContainer}>
                            <button className={styles.btnForm} type="submit" disabled={busy}>Create Account</button>
                            <Link className={styles.btnForm} to="/login">Back to login</Link>
                        </article>
                    </form>
                </section>
            </main>
            <footer>
                <p className={styles.footerText}>© 2026 Eldrid Tales. All rights reserved.</p>
                
            </footer>
        </>
    );
}

export default RegisterPage;
