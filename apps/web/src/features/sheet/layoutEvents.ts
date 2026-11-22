// The sidebar's "Edit sheet layout" button and the sheet are far apart in the page (the sidebar is in the app
// layout, the sheet is the page), so the button sends a small browser event and the sheet listens for it.
export const EDIT_LAYOUT_EVENT = 'tenebris:edit-sheet-layout';

export const requestLayoutEdit = () => window.dispatchEvent(new Event(EDIT_LAYOUT_EVENT));

// Layouts are arranged on a wide screen; a phone follows them (decision A). Same breakpoint as SheetLayout.module.css.
export const WIDE_SCREEN = '(min-width: 721px)';
export const isWideScreen = () => window.matchMedia(WIDE_SCREEN).matches;
