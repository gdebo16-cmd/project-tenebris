import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../api.ts';
import { keys } from '../queries.ts';
import styles from './LoginPage.module.css';

// Replaces Public/signin.html
function LoginPage() {
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const next = params.get('next');
    const dest = next && next.startsWith('/') && !next.startsWith('//') ? next : '/home';
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const queryClient = useQueryClient();

    const submit = async (e) => {
        e.preventDefault(); // stop the browser from reloading the page
        try {
            const me = await api('/api/login', { method: 'POST', body: { username, password } });
            queryClient.clear();                  // forget anything cached for a previous account
            queryClient.setQueryData(keys.me, me); // we already know who is logged in now
            navigate(dest);
        } catch (err) {
            setError(err.message);
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
                        
                        <h2>Welcome to Your Legend</h2>
                    </article>
                    <form onSubmit={submit}>
                        <article className={styles.userNameContainer}>
                            <label className={styles.signinLabel} htmlFor="userName">Enter Username</label>
                            <input className={styles.signinValue} type="text" id="userName" value={username} onChange={(e) => setUsername(e.target.value)} required />
                        </article>

                        <article className={styles.passwordContainer}>
                            <label className={styles.signinLabel} htmlFor="password">Enter Password</label>
                            <input className={styles.signinValue} type="password" id="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                        </article>

                        {error && <p>{error}</p>}

                        <article className={styles.buttonContainer}>
                            <button className={styles.btnForm} type="submit">Login</button>
                            <Link to="/register" className={styles.btnForm}>Create New User</Link>
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

export default LoginPage;
