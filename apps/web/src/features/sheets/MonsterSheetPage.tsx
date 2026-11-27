// The monster sheet (R5.6, L1–L3): the same blocks as the character sheet plus Traits, drawn by SheetLayout
// from the monster layout (layouts.ts). The DM sees and changes everything. Other members of the campaign see a
// glimpse: name, type, a health word and its conditions. Every roll happens on the server.
import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import type { MonsterGlimpse } from '@tenebris/rules/monster';
import Loader from '../../components/ui/Loader.jsx';
import socket from '../../utils/socket.js';
import styles from '../../styles/components/sheets/Sheet.module.css';
import layout from '../../styles/features/sheets/CharacterSheetPage.module.css'; // the sheet pages' header, footer and sheet area
import useHeaderStatusBar from '../../hooks/useHeaderStatusBar.ts';
import { messageOf, useMonsterSheetTools, type Reporter } from './sheetTools.ts';
import type { FeedEntry } from '../../components/sheets/blocks/RollFeed.tsx';
import SheetLayout from '../../components/sheets/SheetLayout.tsx';
import { SheetContext } from '../../components/sheets/blocks/SheetContext.tsx';

// What a player sees of a monster
function Glimpse({ glimpse }: { glimpse: MonsterGlimpse }) {
    return (
        <div className={styles.page}>
            <p className={styles.muted}><Link to="/home">Home</Link></p>
            <div className={styles.column}>
                <section className={styles.block} aria-label="Monster">
                    <div className={styles.header}>
                        <img className={styles.portrait} src={glimpse.portrait ?? '/default-character.png'} alt={`Picture of ${glimpse.name}`} />
                        <div className={styles.headerText}>
                            <h1 className={styles.title}>{glimpse.name}</h1>
                            <p className={styles.muted}>{[glimpse.type, glimpse.health].filter(Boolean).join(' · ')}</p>
                        </div>
                    </div>
                    <div className={styles.chips}>
                        <h2 className={styles.heading}>Conditions</h2>
                        {glimpse.conditions.length === 0 && <span className={styles.muted}>None</span>}
                        {glimpse.conditions.map((c) => <span key={c} className={`${styles.chip} ${styles.chipOn}`}>{c}</span>)}
                    </div>
                </section>
            </div>
        </div>
    );
}

export default function MonsterSheetPage() {
    const { id = '' } = useParams();
    const [feed, setFeed] = useState<FeedEntry[]>([]);
    const nextId = useRef(1);
    const addToFeed = (who: string, text: string) =>
        setFeed((old) => [{ id: nextId.current++, who, text }, ...old].slice(0, 20));

    // Everything the blocks may need (sheetTools.ts); this monster's rolls go straight into its feed
    const report: Reporter = { done: (text) => addToFeed('You', text), failed: (text) => addToFeed('You', text), note: (text) => addToFeed('You', text), feed };
    const { tools, sheet } = useMonsterSheetTools(id, report);
    const campaignId = sheet.data && 'creature' in sheet.data ? sheet.data.creature.monster?.campaignId : undefined;

    useHeaderStatusBar(); // the phone's status bar matches the header

    // The campaign's rolls: players' rolls, and (for the DM) the other monsters' rolls.
    // This monster's own rolls are already added when the server answers, so they're skipped here.
    useEffect(() => {
        if (!campaignId) return;
        socket.connect();
        const join = () => socket.emit('join-campaign', campaignId);
        const onRoll = (roll: { name?: string; label?: string; monsterId?: number }) => {
            if (roll.monsterId === Number(id)) return;
            addToFeed(roll.name ?? 'Someone', roll.label ?? '');
        };
        if (socket.connected) join();
        socket.on('connect', join);
        socket.on('roll', onRoll);
        return () => {
            socket.off('connect', join);
            socket.off('roll', onRoll);
            socket.disconnect();
        };
    }, [campaignId, id]);

    if (sheet.isPending) return <Loader />;
    if (sheet.error) return <p className={styles.error} role="alert">{messageOf(sheet.error)}</p>;
    if (!('creature' in sheet.data)) return <Glimpse glimpse={sheet.data.glimpse} />;
    if (!tools) return null;

    return (
        <SheetContext.Provider value={tools}>
            <header id={layout.siteTitle}>
                <img src="/Logo.png" alt="Eldrid Tales Logo" className={layout.titleLogo} />
            </header>

            <div className={`${styles.page} ${layout.sheetArea}`}>
                <SheetLayout />
            </div>

            <footer className={layout.footer}>
                <p>copyrite Eldrid Tales LLC</p>
            </footer>
        </SheetContext.Provider>
    );
}
