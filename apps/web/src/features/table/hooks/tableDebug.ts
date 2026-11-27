// A flight recorder for the table, switched on by adding ?perf to the page address (off otherwise, costs nothing).
// It writes a timed line to the browser console (F12 → Console) whenever something happens that could make the
// screen flash: the page redrawing, the socket dropping or reconnecting, news from the server, the graphics
// card losing its drawing surface, or the picture sharpness changing. Find the flash, then read the lines around it.
export const tableDebug = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('perf');

const started = performance.now();

export function debugLog(...what: unknown[]) {
    if (!tableDebug) return;
    const seconds = ((performance.now() - started) / 1000).toFixed(1).padStart(6);
    console.log(`[table ${seconds}s]`, ...what);
}

// Counts how often a component draws; logs every draw (and how long since the last one)
let lastDraw = 0;
let draws = 0;
export function debugDraw(name: string) {
    if (!tableDebug) return;
    const now = performance.now();
    draws += 1;
    debugLog(`${name} drew (#${draws}, ${Math.round(now - lastDraw)} ms since last)`);
    lastDraw = now;
}
