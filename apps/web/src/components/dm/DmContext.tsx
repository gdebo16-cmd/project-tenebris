// The DM page's context: its data, its changes, the table's rolls, and the current monster and player (the ones whose
// turn it is, or the ones the DM picked). The DM page provides it once; its blocks (DmBlocks.tsx) read it, and so do
// the "current monster" / "current player" blocks, which are the ordinary sheet blocks drawn for that creature.
import { createContext, useContext, type ReactNode } from 'react';
import shared from '../../styles/components/sheets/Sheet.module.css';
import { SheetContext, type SheetTools } from '../sheets/blocks/SheetContext.tsx';
import type { FeedEntry } from '../sheets/blocks/RollFeed.tsx';
import type { DmPageData, useDmChange } from '../../features/dm/dmQueries.ts';

export type DmTools = {
    campaignId: string;
    data: DmPageData;
    change: ReturnType<typeof useDmChange>;
    feed: FeedEntry[];                    // the table's rolls
    monster: SheetTools | null;           // the current monster's sheet tools (null: none yet, or still loading)
    player: SheetTools | null;            // the current player character's
    monsterId: number | null;
    playerId: number | null;
    pickMonster: (id: number) => void;    // until the turn moves on
    pickPlayer: (id: number) => void;
};

export const DmContext = createContext<DmTools | null>(null);

export function useDmTools(): DmTools {
    const tools = useContext(DmContext);
    if (!tools) throw new Error('useDmTools() needs a <DmContext.Provider> (the DM page) around it');
    return tools;
}

// A sheet block on the DM page, drawn for the current monster or player: it gets that creature's sheet tools.
// With no creature yet, it says how to get one.
export function CurrentCreature({ who, children }: { who: 'monster' | 'player'; children: ReactNode }) {
    const dm = useDmTools();
    const tools = who === 'monster' ? dm.monster : dm.player;
    if (tools) return <SheetContext.Provider value={tools}>{children}</SheetContext.Provider>;
    const waiting = (who === 'monster' ? dm.monsterId : dm.playerId) !== null;
    return (
        <section className={shared.block} aria-label={who === 'monster' ? 'Current monster' : 'Current player'}>
            <span className={shared.muted}>
                {waiting ? 'Loading…' : who === 'monster' ? 'No monster in the encounter yet: add one in Encounter.' : 'No player has picked a character for this campaign yet.'}
            </span>
        </section>
    );
}
