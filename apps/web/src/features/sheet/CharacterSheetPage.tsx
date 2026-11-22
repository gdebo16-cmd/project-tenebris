// The new character sheet (R5): small blocks that all read one Creature built by the server.
// Phone-first: header, then at <=720px a Stats / Combat / Condition tab bar (same look as the
// Actions · Spells · Gear · Features tabs). Desktop still shows every block in two columns.
// Rolls open the roll orb. The text roll feed stays for the campaign DM only.
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
import RollOrb from './blocks/RollOrb.tsx';

const TABS = [
    { id: 'actions', label: 'Actions' },
    { id: 'spells', label: 'Spells' },
    { id: 'gear', label: 'Gear' },
    { id: 'features', label: 'Features' },
] as const;
type TabId = (typeof TABS)[number]['id'];

const MOBILE_TABS = [
    { id: 'stats', label: 'Stats' },
    { id: 'combat', label: 'Combat' },
    { id: 'condition', label: 'Condition' },
] as const;
type MobileTabId = (typeof MOBILE_TABS)[number]['id'];

const messageOf = (err: unknown) => (err instanceof ApiError || err instanceof Error ? err.message : 'Something went wrong');

export default function CharacterSheetPage() {
    const { id = '' } = useParams();
    const sheet = useSheet(id);
    const act = useAct(id);
    const change = useSheetChange(id);
    const sheetDo = useSheetDo(id);
    const [tab, setTab] = useState<TabId>('actions');
    const [mobileTab, setMobileTab] = useState<MobileTabId>('stats');
    const [feed, setFeed] = useState<FeedEntry[]>([]);
    const [orbOpen, setOrbOpen] = useState(false);
    const nextId = useRef(1);

    const addToFeed = (who: string, text: string, mine = false) => {
        setFeed((old) => [{ id: nextId.current++, who, text, mine }, ...old].slice(0, 20));
        if (mine) setOrbOpen(true);
    };

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
    const blockProps = { creature, canEdit, onAct, onNote: note };
    const changeError = [change.hp.error, change.tempHp.error, change.conditions.error].find(Boolean);
    const panel = (id: MobileTabId) => (mobileTab === id ? styles.mobilePanel : styles.mobilePanelHidden);

    return (
        <div className={styles.page}>
            <p className={styles.muted}>
                <Link to="/home">Home</Link>
                {canEdit && <> · <Link to={`/characters/${creature.id}/edit`}>Edit</Link></>}
                {!canEdit && ' · Read-only: this is someone else\'s character'}
            </p>
            <div className={styles.column}>
                <div className={styles.stack}>
                    <SheetHeader creature={creature} />
                    <nav className={styles.mobileTabs} aria-label="Sheet areas">
                        {MOBILE_TABS.map((t) => (
                            <button key={t.id} type="button" className={mobileTab === t.id ? styles.tabActive : styles.tab}
                                aria-pressed={mobileTab === t.id} onClick={() => setMobileTab(t.id)}>{t.label}</button>
                        ))}
                    </nav>
                    <div className={panel('condition')}>
                        <HealthBlock creature={creature} canEdit={canEdit}
                            onHp={(action, amount) => change.hp.mutate({ action, amount })}
                            onWard={(amount) => change.tempHp.mutate(amount)}
                            error={changeError ? messageOf(changeError) : undefined} />
                    </div>
                    <div className={panel('combat')}>
                        <CoreStatsBlock {...blockProps} />
                    </div>
                    <div className={panel('stats')}>
                        <StatsBlock {...blockProps} />
                    </div>
                    <div className={panel('condition')}>
                        <ConditionsBlock creature={creature} canEdit={canEdit} onChange={(body) => change.conditions.mutate(body)} />
                        <RestBlock canEdit={canEdit} busy={sheetDo.isPending} onRest={(type) => onDo({ path: 'rest', body: { type } })} />
                    </div>
                </div>
                <div className={styles.stack}>
                    <div className={panel('combat')}>
                        <nav className={styles.tabs} aria-label="Sheet sections">
                            {TABS.map((t) => (
                                <button key={t.id} type="button" className={tab === t.id ? styles.tabActive : styles.tab}
                                    aria-current={tab === t.id ? 'page' : undefined} onClick={() => setTab(t.id)}>{t.label}</button>
                            ))}
                        </nav>
                        {tab === 'actions' && (
                        <ActionsBlock {...blockProps} id={id}
                            onCast={(actionKey, castLevel) => onDo({ path: 'cast', body: { actionKey, castLevel } })}
                            onUse={(featureKey) => onDo({ path: 'feature', body: { featureKey } })}
                            onRune={(runeKey) => onDo({ path: 'rune', body: { runeKey } })} />
                    )}
                        {tab === 'spells' && (
                            <>
                                <SpellsBlock {...blockProps} onCast={(actionKey, castLevel) => onDo({ path: 'cast', body: { actionKey, castLevel } })} />
                                <SpellBookBlock creature={creature} canEdit={canEdit} id={id} />
                            </>
                        )}
                        {tab === 'gear' && (
                            <>
                                <PurseBlock creature={creature} canEdit={canEdit} id={id} onNote={note} />
                                <InventoryBlock creature={creature} canEdit={canEdit} id={id} onNote={note} />
                            </>
                        )}
                        {tab === 'features' && <FeaturesBlock creature={creature} canEdit={canEdit} onUse={(featureKey) => onDo({ path: 'feature', body: { featureKey } })} />}
                    </div>
                    {access === 'dm' && <RollFeed entries={feed} />}
                </div>
            </div>
            <RollOrb open={orbOpen} rolls={feed} onToggle={() => setOrbOpen((o) => !o)} />
        </div>
    );
}
