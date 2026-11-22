// The monster sheet (R5.6): the same blocks as the character sheet, plus Traits; no Spells or Gear.
// The DM sees and changes everything. Other members of the campaign see a glimpse:
// name, type, a health word and its conditions. Every roll happens on the server.
import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import type { ActRequest } from '@tenebris/rules/actions';
import type { MonsterGlimpse } from '@tenebris/rules/monster';
import { ApiError } from '../../api.ts';
import Loader from '../../components/Loader.jsx';
import socket from '../../utils/socket.js';
import styles from './Sheet.module.css';
import { useMonsterAct, useMonsterChange, useMonsterSheet } from './monsterQueries.ts';
import SheetHeader from './blocks/SheetHeader.tsx';
import HealthBlock from './blocks/HealthBlock.tsx';
import CoreStatsBlock from './blocks/CoreStatsBlock.tsx';
import StatsBlock from './blocks/StatsBlock.tsx';
import ConditionsBlock from './blocks/ConditionsBlock.tsx';
import ActionsBlock from './blocks/ActionsBlock.tsx';
import FeaturesBlock from './blocks/FeaturesBlock.tsx';
import TraitsBlock from './blocks/TraitsBlock.tsx';
import RollFeed, { type FeedEntry } from './blocks/RollFeed.tsx';

const messageOf = (err: unknown) => (err instanceof ApiError || err instanceof Error ? err.message : 'Something went wrong');

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
    const sheet = useMonsterSheet(id);
    const act = useMonsterAct(id);
    const change = useMonsterChange(id);
    const [feed, setFeed] = useState<FeedEntry[]>([]);
    const nextId = useRef(1);
    const campaignId = sheet.data && 'creature' in sheet.data ? sheet.data.creature.monster?.campaignId : undefined;

    const addToFeed = (who: string, text: string) =>
        setFeed((old) => [{ id: nextId.current++, who, text }, ...old].slice(0, 20));

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

    const onAct = (request: ActRequest) => {
        act.mutateAsync(request).then((r) => addToFeed('You', r.text), (err) => addToFeed('You', `Roll failed: ${messageOf(err)}`));
    };

    if (sheet.isPending) return <Loader />;
    if (sheet.error) return <p className={styles.error} role="alert">{messageOf(sheet.error)}</p>;
    if (!('creature' in sheet.data)) return <Glimpse glimpse={sheet.data.glimpse} />;

    const { creature, canEdit } = sheet.data;
    const blockProps = { creature, canEdit, onAct, onNote: (text: string) => addToFeed('You', text) };
    const changeError = [change.hp.error, change.tempHp.error, change.conditions.error, change.notes.error].find(Boolean);

    return (
        <div className={styles.page}>
            <p className={styles.muted}>
                <Link to="/home">Home</Link>
                {creature.monster && <> · <Link to={`/campaign/${creature.monster.campaignId}/dm`}>DM page</Link></>}
            </p>
            <div className={styles.column}>
                <div className={styles.stack}>
                    <SheetHeader creature={creature} />
                    <HealthBlock creature={creature} canEdit={canEdit}
                        onHp={(action, amount) => change.hp.mutate({ action, amount })}
                        onWard={(amount) => change.tempHp.mutate(amount)}
                        error={changeError ? messageOf(changeError) : undefined} />
                    <CoreStatsBlock {...blockProps} />
                    <StatsBlock {...blockProps} />
                    <ConditionsBlock creature={creature} canEdit={canEdit} onChange={(body) => change.conditions.mutate(body)} />
                </div>
                <div className={styles.stack}>
                    <ActionsBlock {...blockProps} id={id} onCast={() => {}} onUse={() => {}} onRune={() => {}} />
                    <TraitsBlock creature={creature} canEdit={canEdit} saving={change.notes.isPending} onSaveNotes={(notes) => change.notes.mutate(notes)} />
                    <FeaturesBlock creature={creature} canEdit={false} onUse={() => {}} />
                    <RollFeed entries={feed} />
                </div>
            </div>
        </div>
    );
}
