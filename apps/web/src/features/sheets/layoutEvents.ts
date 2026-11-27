import { useSyncExternalStore } from 'react';

// The sidebar's "Edit sheet layout" button and the sheet are far apart in the page (the sidebar is in the app
// layout, the sheet is the page), so the button sends a small browser event and the sheet listens for it.
export const EDIT_LAYOUT_EVENT = 'tenebris:edit-sheet-layout';

export const requestLayoutEdit = () => window.dispatchEvent(new Event(EDIT_LAYOUT_EVENT));

// A wide screen shows the desktop layout (the grid); a phone shows its own mobile layout (a stack). Both can be arranged.
// Same breakpoint as SheetLayout.module.css.
export const WIDE_SCREEN = '(min-width: 721px)';
export const isWideScreen = () => window.matchMedia(WIDE_SCREEN).matches;

// Whether the screen is wide now; re-renders when it changes (rotating a tablet, resizing the window)
const subscribe = (onChange: () => void) => {
    const query = window.matchMedia(WIDE_SCREEN);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
};
export const useIsWide = () => useSyncExternalStore(subscribe, isWideScreen, () => true);
