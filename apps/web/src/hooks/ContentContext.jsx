import { ContentContext } from './useContent';
import { useContentPack } from '../queries.ts';

// The old content cache lived in localStorage under 'umberContent' and filled it to ~4.5 MB.
// The browser's own HTTP cache does that job now (see useContentPack), so free the space once.
try { localStorage.removeItem('umberContent'); } catch { /* storage unavailable: nothing to free */ }

// Gives every page the game content pack through useContent(), loaded once via TanStack Query.
export function ContentProvider({ children }) {
    const { data, error } = useContentPack();
    return (
        <ContentContext.Provider value={{ content: data ?? null, error: error?.message ?? null }}>
            {children}
        </ContentContext.Provider>
    );
}
