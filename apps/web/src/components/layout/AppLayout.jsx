import { Outlet } from 'react-router';
import Sidebar from './Sidebar';

// Every logged-in page: the sidebar, then the page itself (<Outlet />)
export default function AppLayout() {
    return (
        <>
            <Sidebar />
            <Outlet />
        </>
    );
}