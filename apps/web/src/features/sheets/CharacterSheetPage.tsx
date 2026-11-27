// The character sheet (R5, L1–L3): the page loads the character, sets up rolling and changes, and puts them in
// the sheet context. SheetLayout then draws the blocks where the layout says (layouts.ts: the default, or the
// player's own saved in this browser). Phone: reading order under Stats / Combat / Condition tabs.
// Rolls open the roll orb. The text roll feed is a block, shown to the campaign DM only.
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router';
import Loader from '../../components/ui/Loader.jsx';
import socket from '../../utils/socket.js';
import styles from '../../styles/components/sheets/Sheet.module.css';
import { messageOf, useCharacterSheetTools, type Reporter } from './sheetTools.ts';
import type { FeedEntry } from '../../components/sheets/blocks/RollFeed.tsx';
import RollOrb from '../../components/sheets/blocks/RollOrb.tsx';
import layout from '../../styles/features/sheets/CharacterSheetPage.module.css';
import useHeaderStatusBar from '../../hooks/useHeaderStatusBar.ts';
import SheetLayout from '../../components/sheets/SheetLayout.tsx';
import { SheetContext } from '../../components/sheets/blocks/SheetContext.tsx';

export default function CharacterSheetPage() {
    const { id = '' } = useParams();
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

    // Everything the blocks may need (sheetTools.ts). Rolls, casts and rests: their text goes to the roll orb
    // (and the DM's feed); a failure opens the orb too.
    const report: Reporter = { done: note, failed: (text) => addToFeed('You', text, true), note, feed };
    const { tools, sheet } = useCharacterSheetTools(id, report);

    if (sheet.isPending) return <Loader />;
    if (sheet.error) return <p className={styles.error} role="alert">{messageOf(sheet.error)}</p>;
    if (!tools) return null;

    return (
        <SheetContext.Provider value={tools}>
            <header id={layout.siteTitle}>
                <img src="/icons/Logo.png" alt="Eldrid Tales Logo" className={layout.titleLogo} />
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
