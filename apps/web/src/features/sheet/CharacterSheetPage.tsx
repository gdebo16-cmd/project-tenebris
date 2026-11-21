// The new character sheet (R5): small blocks that all read one Creature built by the server.
// Phone-first: header, health, core stats, stats, conditions, then tabs (Actions · Spells · Gear · Features), and the roll feed.
// On a wide screen the blocks sit in two columns.
import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import type { ActRequest } from '@tenebris/rules/actions';
import { ApiError } from '../../api.ts';
import Loader from '../../components/Loader.jsx';
import socket from '../../utils/socket.js';
import styles from './Sheet.module.css';
import { useAct, useSheet, useSheetChange, useSheetDo, type SheetDo } from './queries.ts';
import SheetHeader from './blocks/SheetHeader.tsx';
import HealthBlock from './blocks/HealthBlock.tsx';
import CoreStatsBlock from './blocks/CoreStatsBlock.tsx';
import StatsBlock from './blocks/StatsBlock.tsx';
import ConditionsBlock from './blocks/ConditionsBlock.tsx';
import ActionsBlock from './blocks/ActionsBlock.tsx';
import SpellsBlock from './blocks/SpellsBlock.tsx';
import InventoryBlock from './blocks/InventoryBlock.tsx';
import PurseBlock from './blocks/PurseBlock.tsx';
import FeaturesBlock from './blocks/FeaturesBlock.tsx';
import RestBlock from './blocks/RestBlock.tsx';
import SpellBookBlock from './blocks/SpellBookBlock.tsx';
import RollFeed, { type FeedEntry } from './blocks/RollFeed.tsx';

const TABS = [
    { id: 'actions', label: 'Actions' },
    { id: 'spells', label: 'Spells' },
    { id: 'gear', label: 'Gear' },
    { id: 'features', label: 'Features' },
] as const;
type TabId = (typeof TABS)[number]['id'];

const messageOf = (err: unknown) => (err instanceof ApiError || err instanceof Error ? err.message : 'Something went wrong');

export default function CharacterSheetPage() {
    const { id = '' } = useParams();
    const sheet = useSheet(id);
    const act = useAct(id);
    const change = useSheetChange(id);
    const sheetDo = useSheetDo(id);
    const [tab, setTab] = useState<TabId>('actions');
    const [feed, setFeed] = useState<FeedEntry[]>([]);
    const nextId = useRef(1);

    const addToFeed = (who: string, text: string) =>
        setFeed((old) => [{ id: nextId.current++, who, text }, ...old].slice(0, 20));

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
        addToFeed('You', text);
    };

    const onAct = (request: ActRequest, prefix = '') => {
        act.mutateAsync(request).then((r) => note(`${prefix}${r.text}`), (err) => addToFeed('You', `Roll failed: ${messageOf(err)}`));
    };

    // Feature uses, rests and casting: the server decides and saves; its text goes to the roll feed
    const onDo = (request: SheetDo, prefix = '') => {
        sheetDo.mutateAsync(request).then((r) => note(`${prefix}${r.text}`), (err) => addToFeed('You', messageOf(err)));
    };

    if (sheet.isPending) return <Loader />;
    if (sheet.error) return <p className={styles.error} role="alert">{messageOf(sheet.error)}</p>;

    const { creature, canEdit } = sheet.data;
    const blockProps = { creature, canEdit, onAct, onNote: note };
    const changeError = [change.hp.error, change.tempHp.error, change.conditions.error].find(Boolean);

    return (
        <div className={styles.page}>
            <p className={styles.muted}>
                <Link to="/home">Home</Link> · <Link to={`/characters/${creature.id}`}>Old sheet</Link>
                {canEdit && <> · <Link to={`/characters/${creature.id}/edit`}>Edit</Link></>}
                {!canEdit && ' · Read-only: this is someone else\'s character'}
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
                    <RestBlock canEdit={canEdit} busy={sheetDo.isPending} onRest={(type) => onDo({ path: 'rest', body: { type } })} />
                </div>
                <div className={styles.stack}>
                    <nav className={styles.tabs} aria-label="Sheet sections">
                        {TABS.map((t) => (
                            <button key={t.id} type="button" className={`${styles.tab} ${tab === t.id ? styles.tabActive : ''}`}
                                aria-current={tab === t.id ? 'page' : undefined} onClick={() => setTab(t.id)}>{t.label}</button>
                        ))}
                    </nav>
                    {tab === 'actions' && <ActionsBlock {...blockProps} />}
                    {tab === 'spells' && (
                        <>
                            <SpellsBlock {...blockProps} onCast={(actionKey, castLevel) => onDo({ path: 'cast', body: { actionKey, castLevel } })} />
                            <SpellBookBlock creature={creature} canEdit={canEdit} id={id} />
                        </>
                    )}
                    {tab === 'gear' && (
                        <>
                            <PurseBlock creature={creature} canEdit={canEdit} id={id} onNote={note} />
                            <InventoryBlock creature={creature} canEdit={canEdit} />
                        </>
                    )}
                    {tab === 'features' && <FeaturesBlock creature={creature} canEdit={canEdit} onUse={(featureKey) => onDo({ path: 'feature', body: { featureKey } })} />}
                    <RollFeed entries={feed} />
                </div>
            </div>
        </div>
    );
}
