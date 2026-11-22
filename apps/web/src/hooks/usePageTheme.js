import { useEffect } from 'react';
import { useLocation } from 'react-router';

// Safari colors the status bar with the theme-color tag. Our title color is see-through,
// so drop its transparency and use the solid version of the same color.
function syncStatusBarColor() {
    const css = getComputedStyle(document.documentElement);
    // a page can ask for its own color (--status-bar, see base.css), else the theme's title color,
    // else the see-through one
    const raw = (css.getPropertyValue('--status-bar') || css.getPropertyValue('--bgc-title')
        || css.getPropertyValue('--bg-color-1')).trim();
    // let the browser turn any color (#240303, color-mix(...)) into rgb(...)
    const probe = document.createElement('i');
    probe.style.color = raw;
    document.body.appendChild(probe);
    const nums = getComputedStyle(probe).color.match(/[\d.]+/g);
    probe.remove();
    if (!nums || nums.length < 3) return;
    const solid = `rgb(${nums[0]}, ${nums[1]}, ${nums[2]})`;
    let tag = document.querySelector('meta[name="theme-color"]');
    if (!tag) {
        tag = document.createElement('meta');
        tag.name = 'theme-color';
        document.head.appendChild(tag);
    }
    tag.content = solid;
    document.documentElement.style.setProperty('--status-solid', solid); // used by the edge fade in CSS
}

function usePageTheme() {
    const { pathname} = useLocation();
    useEffect(() => {
        // every page, character sheet included, uses the theme picked on the profile page
        const theme = localStorage.getItem('siteTheme') || 'default';
        document.documentElement.setAttribute('data-theme', theme);
        syncStatusBarColor();
    }, [pathname]);

    useEffect(() => {
        // also follow live theme changes from the theme picker
        const watcher = new MutationObserver(syncStatusBarColor);
        watcher.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-status-bar'] });
        return () => watcher.disconnect();
    }, []);
}

export default usePageTheme;