// Sheet layouts: the default for each kind of sheet (L3), and the player's own, saved to their account (L4)
// with a copy in this browser so the sheet shows the right layout at once, before the server answers.
import { useCallback, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { checkLayout, type SheetKind, type SheetLayout } from '@tenebris/rules/layout';
import { api } from '../../api.ts';
import { blocksFor } from './blocks/registry.tsx';

// The default layouts, on the 12 × 16 grid (GRID in @tenebris/rules/layout). Each block fills its cells; content that
// doesn't fit scrolls inside the block. On a phone the same blocks stack in reading order (top row first, then left to right).
export const DEFAULT_LAYOUTS: Record<SheetKind, SheetLayout> = {
    //  columns 1–8                                   9–12
    //  header (rows 1–3)                             actionPanel (rows 1–16)
    //  health (4–7)            core (4–7)
    //  stats (8–13)            skills (8–13)
    //  conditions (14–16)          rest (14–16)
    //  (the roll feed is hidden: it only ever shows to the DM, who can add it)
    character: {
        version: 2,
        items: [
            { block: 'header', col: 1, row: 1, colSpan: 8, rowSpan: 3 },
            { block: 'actionPanel', col: 9, row: 1, colSpan: 4, rowSpan: 16 },
            { block: 'health', col: 1, row: 4, colSpan: 4, rowSpan: 4 },
            { block: 'core', col: 5, row: 4, colSpan: 4, rowSpan: 4 },
            { block: 'stats', col: 1, row: 8, colSpan: 4, rowSpan: 6 },
            { block: 'skills', col: 5, row: 8, colSpan: 4, rowSpan: 6 },
            { block: 'conditions', col: 1, row: 14, colSpan: 5, rowSpan: 3 },
            { block: 'rest', col: 6, row: 14, colSpan: 3, rowSpan: 3 },
        ],
    },
    //  header (1–3)                                  actions (1–9)
    //  health (4–7)            core (4–7)
    //  stats (8–13)            skills (8–13)         features (10–12)
    //  conditions (14–16)      traits (14–16)        rollFeed (13–16)
    monster: {
        version: 2,
        items: [
            { block: 'header', col: 1, row: 1, colSpan: 8, rowSpan: 3 },
            { block: 'actions', col: 9, row: 1, colSpan: 4, rowSpan: 6 },
            { block: 'legendary', col: 9, row: 7, colSpan: 4, rowSpan: 3 },
            { block: 'health', col: 1, row: 4, colSpan: 4, rowSpan: 4 },
            { block: 'core', col: 5, row: 4, colSpan: 4, rowSpan: 4 },
            { block: 'stats', col: 1, row: 8, colSpan: 4, rowSpan: 6 },
            { block: 'skills', col: 5, row: 8, colSpan: 4, rowSpan: 6 },
            { block: 'features', col: 9, row: 10, colSpan: 4, rowSpan: 3 },
            { block: 'conditions', col: 1, row: 14, colSpan: 4, rowSpan: 3 },
            { block: 'traits', col: 5, row: 14, colSpan: 4, rowSpan: 3 },
            { block: 'rollFeed', col: 9, row: 13, colSpan: 4, rowSpan: 4 },
        ],
    },
    //  columns 1–3             4–7                       8–12
    //  initiative (1–7)        party (1–6)               encounter (1–6)
    //  rolls (8–12)            player header (7–9)       monster header (7–9)
    //  notes (13–16)           player health (10–12)     monster health (10–12)
    //                          player afflictions (13–16) monster actions (13–16)
    //  (the other current-monster / current-player blocks are hidden: add them in the editor)
    dm: {
        version: 2,
        items: [
            { block: 'initiative', col: 1, row: 1, colSpan: 3, rowSpan: 7 },
            { block: 'tableRolls', col: 1, row: 8, colSpan: 3, rowSpan: 5 },
            { block: 'dmNotes', col: 1, row: 13, colSpan: 3, rowSpan: 4 },
            { block: 'party', col: 4, row: 1, colSpan: 4, rowSpan: 6 },
            { block: 'pcHeader', col: 4, row: 7, colSpan: 4, rowSpan: 3 },
            { block: 'pcHealth', col: 4, row: 10, colSpan: 4, rowSpan: 3 },
            { block: 'pcConditions', col: 4, row: 13, colSpan: 4, rowSpan: 4 },
            { block: 'encounter', col: 8, row: 1, colSpan: 5, rowSpan: 6 },
            { block: 'monHeader', col: 8, row: 7, colSpan: 5, rowSpan: 3 },
            { block: 'monHealth', col: 8, row: 10, colSpan: 5, rowSpan: 3 },
            { block: 'monActions', col: 8, row: 13, colSpan: 5, rowSpan: 4 },
        ],
    },
};

// Whether a kind of sheet groups its blocks under phone tabs on a phone
export const PHONE_TABS_ON: Record<SheetKind, boolean> = { character: true, monster: true, dm: true };

type SavedLayouts = Partial<Record<SheetKind, SheetLayout>>;
const layoutsKey = ['layouts'] as const;
const storageKey = (kind: SheetKind) => `tenebris.sheetLayout.${kind}`;

// A layout checked against this sheet's blocks, or null
const checked = (raw: unknown, kind: SheetKind): SheetLayout | null => {
    const r = checkLayout(raw, blocksFor(kind));
    return 'layout' in r ? r.layout : null;
};

// The browser's copy. Browser storage can be missing or blocked: never throw.
function readCopy(kind: SheetKind): SheetLayout | null {
    try {
        const saved = localStorage.getItem(storageKey(kind));
        return saved ? checked(JSON.parse(saved), kind) : null;
    } catch {
        return null;
    }
}
function writeCopy(kind: SheetKind, layout: SheetLayout | null) {
    try {
        if (layout) localStorage.setItem(storageKey(kind), JSON.stringify(layout));
        else localStorage.removeItem(storageKey(kind));
    } catch { /* the account still has it */ }
}

// The player's saved layouts (one request for both kinds)
export function useSavedLayouts() {
    return useQuery({ queryKey: layoutsKey, queryFn: () => api<SavedLayouts>('/api/layouts'), staleTime: 5 * 60 * 1000 });
}

export type LayoutControls = {
    layout: SheetLayout;                     // what to draw
    isDefault: boolean;                      // no layout of their own yet
    save: (next: SheetLayout | null) => Promise<string | null>;   // null = back to the default. Answers an error or null.
    saving: boolean;
};

export function useSheetLayout(kind: SheetKind): LayoutControls {
    const saved = useSavedLayouts();
    const queryClient = useQueryClient();

    // The server's answer wins; until it comes, the browser's copy; else the default
    const fromServer = saved.data ? checked(saved.data[kind], kind) : undefined;
    const own = saved.data ? fromServer : readCopy(kind);
    const layout = own ?? DEFAULT_LAYOUTS[kind];

    // Keep the browser's copy in step with the account (e.g. after editing on another device)
    useEffect(() => {
        if (saved.data) writeCopy(kind, fromServer ?? null);
    }, [saved.data, fromServer, kind]);

    const mutation = useMutation({
        mutationFn: (next: SheetLayout | null) => next
            ? api<SheetLayout>(`/api/layouts/${kind}`, { method: 'PUT', body: next })
            : api(`/api/layouts/${kind}`, { method: 'DELETE' }).then(() => null),
        onSuccess: (result) => {
            writeCopy(kind, result);
            queryClient.setQueryData<SavedLayouts>(layoutsKey, (old) => {
                const next = { ...(old ?? {}) };
                if (result) next[kind] = result;
                else delete next[kind];
                return next;
            });
        },
    });

    const save = useCallback(async (next: SheetLayout | null) => {
        if (next) {
            const check = checkLayout(next, blocksFor(kind));
            if ('error' in check) return check.error;
        }
        try {
            await mutation.mutateAsync(next);
            return null;
        } catch (err) {
            return err instanceof Error ? err.message : 'Could not save the layout';
        }
    }, [kind, mutation]);

    return { layout, isDefault: !own, save, saving: mutation.isPending };
}
