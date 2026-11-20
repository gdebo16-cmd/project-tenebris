import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../api.ts';

// "Log Out" in the Settings dropdown: ends the session on the server, forgets everything
// cached for this account, then goes to /login.
function LogoutLink() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const logout = async (e) => {
        e.preventDefault();
        await api('/api/logout', { method: 'POST' }).catch(() => {}); // leave even if the server is unreachable
        queryClient.clear();
        navigate('/login');
    };

    return (
        <a id="logout" className="btn-drop-settings" href="/login" onClick={logout}>Log Out</a>
    );
}

export default LogoutLink;
