// The DM page (R5.7): one screen for a campaign, laid out like a sheet (a 'dm' layout: the default in
// sheet/layouts.ts, or the DM's own from "Edit sheet layout"). Its blocks: Initiative, Notes, the table's Rolls,
// Party and Encounter (DmBlocks.tsx), plus the current monster's and the current player's sheet blocks.
// "Current" follows the initiative turn; "Show" in Party or Encounter picks one until the turn moves on; with no
// fight, the first in the list. The server rolls initiative and every attack; HP changes go through the sheets' routes.
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import Loader from '../../components/ui/Loader.jsx';
import socket from '../../utils/socket.js';
import sheet from '../sheet/Sheet.module.css';
import layout from '../sheet/CharacterSheetPage.module.css'; // the sheet pages' header, footer and sheet area
import useHeaderStatusBar from '../../hooks/useHeaderStatusBar.ts';
import SheetLayout from '../sheet/SheetLayout.tsx';
import type { FeedEntry } from '../sheet/blocks/RollFeed.tsx';
import { messageOf, useCharacterSheetTools, useMonsterSheetTools, type Reporter } from '../sheet/sheetTools.ts';
import { dmKey, useDmChange, useDmPage } from './dmQueries.ts';
import { DmContext, type DmTools } from './DmContext.tsx';

type Pick = { id: number; turnKey: string } | null;

export default function DmPage() {
    const { campId = '' } = useParams();
    const page = useDmPage(campId);
    const change = useDmChange(campId);
    const queryClient = useQueryClient();
    const [feed, setFeed] = useState<FeedEntry[]>([]);
    const nextId = useRef(1);
    const [pickedMonster, setPickedMonster] = useState<Pick>(null);
    const [pickedPlayer, setPickedPlayer] = useState<Pick>(null);
    useHeaderStatusBar(); // the phone's status bar matches the header

    const addToFeed = (who: string, text: string) =>
        setFeed((old) => [{ id: nextId.current++, who, text }, ...old].slice(0, 40));

    // The table's rolls: players' rolls and the server's monster rolls (the DM room)
    useEffect(() => {
        if (!campId) return;
        socket.connect();
        const join = () => socket.emit('join-campaign', campId);
        const onRoll = (roll: { name?: string; label?: string }) =>
            setFeed((old) => [{ id: nextId.current++, who: roll.name ?? 'Someone', text: roll.label ?? '' }, ...old].slice(0, 40));
        if (socket.connected) join();
        socket.on('connect', join);
        socket.on('roll', onRoll);
        return () => {
            socket.off('connect', join);
            socket.off('roll', onRoll);
            socket.disconnect();
        };
    }, [campId]);

    // Who's current. A pick counts only during the turn it was made in (turnKey), so the next turn takes over again.
    const data = page.data;
    const init = data?.initiative ?? null;
    const turn = init ? init.order[init.turn] : undefined;
    const turnKey = init ? `${init.round}:${init.turn}` : 'none';
    const monsterId = (pickedMonster?.turnKey === turnKey ? pickedMonster.id : null)
        ?? (turn?.kind === 'monster' ? Number(turn.id) : null)
        ?? data?.encounter[0]?.id ?? null;
    const playerId = (pickedPlayer?.turnKey === turnKey ? pickedPlayer.id : null)
        ?? (turn?.kind === 'character' ? Number(turn.id) : null)
        ?? data?.party[0]?.id ?? null;

    // Their sheet tools. A change made in their blocks reloads the DM page's lists too.
    const changed = () => { queryClient.invalidateQueries({ queryKey: dmKey(campId) }); };
    // a monster's rolls come back through the DM room (socket above), so only failures are added here
    const monsterReport: Reporter = { done: () => {}, failed: (text) => addToFeed('You', text), note: (text) => addToFeed('You', text), feed, changed };
    // a player's rolls made here go to the feed, and to everyone else in the campaign
    const playerNote = (text: string) => { socket.emit('roll', text); addToFeed('You', text); };
    const playerReport: Reporter = { done: playerNote, failed: (text) => addToFeed('You', text), note: playerNote, feed, changed };
    const monster = useMonsterSheetTools(monsterId === null ? null : String(monsterId), monsterReport);
    const player = useCharacterSheetTools(playerId === null ? null : String(playerId), playerReport);

    if (page.isPending) return <Loader />;
    if (page.error) return <p className={sheet.error} role="alert">{messageOf(page.error)}</p>;

    const dm: DmTools = {
        campaignId: campId,
        data: page.data,
        change,
        feed,
        monster: monster.tools,
        player: player.tools,
        monsterId,
        playerId,
        pickMonster: (id) => setPickedMonster({ id, turnKey }),
        pickPlayer: (id) => setPickedPlayer({ id, turnKey }),
    };

    return (
        <DmContext.Provider value={dm}>
            <header id={layout.siteTitle}>
                <img src="/Logo.png" alt="Eldrid Tales Logo" className={layout.titleLogo} />
            </header>

            <div className={`${sheet.page} ${layout.sheetArea}`}>
                <SheetLayout kind="dm" />
            </div>

            <footer className={layout.footer}>
                <p>copyrite Eldrid Tales LLC</p>
            </footer>
        </DmContext.Provider>
    );
}
