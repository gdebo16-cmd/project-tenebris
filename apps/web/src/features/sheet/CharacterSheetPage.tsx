// The character sheet (R5, L1–L3): the page loads the character, sets up rolling and changes, and puts them in
// the sheet context. SheetLayout then draws the blocks where the layout says (layouts.ts: the default, or the
// player's own saved in this browser). Phone: reading order under Stats / Combat / Condition tabs.
// Rolls open the roll orb. The text roll feed is a block, shown to the campaign DM only.
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router';
import type { ActRequest } from '@tenebris/rules/actions';
import { ApiError } from '../../api.ts';
import Loader from '../../components/Loader.jsx';
import socket from '../../utils/socket.js';
import styles from './Sheet.module.css';
import { useAct, useSheet, useSheetChange, useSheetDo, type SheetDo } from './queries.ts';
import type { FeedEntry } from './blocks/RollFeed.tsx';
import RollOrb from './blocks/RollOrb.tsx';
import layout from './CharacterSheetPage.module.css';
import useHeaderStatusBar from '../../hooks/useHeaderStatusBar.ts';
import SheetLayout from './SheetLayout.tsx';
import { SheetContext, type SheetTools } from './blocks/SheetContext.tsx';

const messageOf = (err: unknown) => (err instanceof ApiError || err instanceof Error ? err.message : 'Something went wrong');

export default function CharacterSheetPage() {
    const { id = '' } = useParams();
    const sheet = useSheet(id);
    const act = useAct(id);
    const change = useSheetChange(id);
    const sheetDo = useSheetDo(id);
    const [feed, setFeed] = useState<FeedEntry[]>([]);
    const [orbOpen, setOrbOpen] = useState(false);
    const nextId = useRef(1);

    const addToFeed = (who: string, text: string, mine = false) => {
        setFeed((old) => [{ id: nextId.current++, who, text, mine }, ...old].slice(0, 20));
        if (mine) setOrbOpen(true);
    };

    useHeaderStatusBar(); // the phone's status bar matches the header

    // Rolls are shared with everyone looking at this sheet, the same way the old sheet does it
    useEffect(() => {
        socket.connect();
        const onConnect = () => socket.emit('join-sheet', id);
        const onRoll = (roll: { name?: string; label?: string }) => addToFeed(roll.name ?? 'Someone', roll.label ?? '');
        socket.on('connect', onConnect);
        socket.on('roll', onRoll);
        return () => {
            socket.off('connect', onConnect);
            socket.off('roll', onRoll);
            socket.disconnect();
        };
    }, [id]);

    const note = (text: string) => {
        socket.emit('roll', text);
        addToFeed('You', text, true);
    };

    const onAct = (request: ActRequest, prefix = '') => {
        act.mutateAsync(request).then((r) => note(`${prefix}${r.text}`), (err) => addToFeed('You', `Roll failed: ${messageOf(err)}`, true));
    };

    // Feature uses, rests and casting: the server decides and saves; its text goes to the roll orb (and the DM feed)
    const onDo = (request: SheetDo, prefix = '') => {
        sheetDo.mutateAsync(request).then((r) => note(`${prefix}${r.text}`), (err) => addToFeed('You', messageOf(err), true));
    };

    if (sheet.isPending) return <Loader />;
    if (sheet.error) return <p className={styles.error} role="alert">{messageOf(sheet.error)}</p>;

    const { creature, canEdit, access } = sheet.data;
    const changeError = [change.hp.error, change.tempHp.error, change.conditions.error].find(Boolean);

    // Everything the blocks may need (blocks/SheetContext.tsx)
    const tools: SheetTools = {
        kind: 'character',
        id,
        creature,
        canEdit,
        access,
        act: onAct,
        note,
        run: onDo,
        busy: sheetDo.isPending,
        hp: (action, amount) => change.hp.mutate({ action, amount }),
        ward: (amount) => change.tempHp.mutate(amount),
        setConditions: (body) => change.conditions.mutate(body),
        saveNotes: () => {},
        savingNotes: false,
        changeError: changeError ? messageOf(changeError) : undefined,
        feed,
    };

    return (
        <SheetContext.Provider value={tools}>
            <header id={layout.siteTitle}>
                <img src="/Logo.png" alt="Eldrid Tales Logo" className={layout.titleLogo} />
            </header>

            <div className={`${styles.page} ${layout.sheetArea}`}>
                <SheetLayout />
                <RollOrb open={orbOpen} rolls={feed} onToggle={() => setOrbOpen((o) => !o)} />
            </div>

            <footer className={layout.footer}>
                <p>copyrite Eldrid Tales LLC</p>
            </footer>
        </SheetContext.Provider>
    );
}
