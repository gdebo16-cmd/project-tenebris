// The sheet context (L1): everything a block may need, provided once by the page (character or monster sheet).
// Blocks themselves still take plain props; the block list (registry.tsx) reads this and hands each block
// what it needs. That is what lets a layout put any block anywhere.
import { createContext, useContext } from 'react';
import type { ActRequest } from '@tenebris/rules/actions';
import type { Creature } from '@tenebris/rules/creature';
import type { SheetDo } from '../../../features/sheets/queries.ts';
import type { FeedEntry } from './RollFeed.tsx';

export type SheetKind = 'character' | 'monster';

export type SheetTools = {
    kind: SheetKind;
    id: string;                                                    // the character's or campaign monster's id
    creature: Creature;
    canEdit: boolean;
    access: 'owner' | 'dm' | 'viewer';
    act: (request: ActRequest, prefix?: string) => void;          // ask the server to roll
    note: (text: string) => void;                                 // a message in the roll feed, no roll
    run: (request: SheetDo, prefix?: string) => void;             // cast, use a feature or rune, rest (character sheet)
    busy: boolean;                                                // a run() is still waiting for the server
    hp: (action: 'heal' | 'damage', amount: number) => void;
    ward: (amount: number) => void;
    setConditions: (body: { conditions?: Record<string, boolean>; exhaustion?: number }) => void;
    saveNotes: (notes: string) => void;                           // the DM's notes (monster sheet)
    savingNotes: boolean;
    changeError?: string;                                         // the last failed HP / ward / conditions / notes change
    feed: FeedEntry[];                                            // recent rolls
};

export const SheetContext = createContext<SheetTools | null>(null);

// For anything inside a sheet page. Outside one it's a programming mistake, so it says so loudly.
export function useSheetTools(): SheetTools {
    const tools = useContext(SheetContext);
    if (!tools) throw new Error('useSheetTools() needs a <SheetContext.Provider> (a sheet page) around it');
    return tools;
}
