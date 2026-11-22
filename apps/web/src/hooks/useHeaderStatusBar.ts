import { useEffect } from 'react';

// While the page using this is open, the phone's status bar takes the header's color
// (base.css reads data-status-bar; usePageTheme turns it into the theme-color tag).
export default function useHeaderStatusBar() {
    useEffect(() => {
        document.documentElement.dataset.statusBar = 'surface';
        return () => { delete document.documentElement.dataset.statusBar; };
    }, []);
}
