import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import Loader from './Loader';
import { useMe, useProfile } from '../queries.ts';

// Saved look settings follow the account to any device: copy them onto the page.
const LOOKS = [['site_theme', 'siteTheme', 'data-theme'], ['site_background', 'siteBackground', 'data-background'], ['site_display', 'siteDisplay', 'data-display']];

// Wrap pages that need a logged-in user. Asks the server "who am I?" (/api/me).
// Not logged in -> send them to /login. Logged in -> show the page (<Outlet />).
function RequireLogin() {
    const location = useLocation();
    const me = useMe();
    const profile = useProfile(me.isSuccess); // only ask for the profile once we know who you are

    useEffect(() => {
        const p = profile.data;
        if (!p) return;
        for (const [field, storageKey, attr] of LOOKS) {
            if (p[field]) {
                localStorage.setItem(storageKey, p[field]);
                document.documentElement.setAttribute(attr, p[field]);
            }
        }
    }, [profile.data]);

    if (me.isPending) return <Loader />;
    if (me.isError) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
    return <Outlet />;
}

export default RequireLogin;
