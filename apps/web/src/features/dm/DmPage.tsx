// The DM page (R5.7): one screen for a campaign. Laptop/tablet first, stacks on phones.
// Left: turn order, private notes and the table's rolls. Right: the party and the encounter.
// The server rolls initiative and every attack; HP changes go through the sheets' own routes.
import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ApiError } from '../../api.ts';
import Loader from '../../components/Loader.jsx';
import socket from '../../utils/socket.js';
import sheet from '../sheet/Sheet.module.css';
import styles from './DmPage.module.css';
import layout from '../sheet/CharacterSheetPage.module.css'; // the sheet pages' header and footer
import useHeaderStatusBar from '../../hooks/useHeaderStatusBar.ts';
import RollFeed, { type FeedEntry } from '../sheet/blocks/RollFeed.tsx';
import { useDmChange, useDmPage, useMonsterCatalog, type DmPageData, type EncounterMonster, type PartyMember } from './dmQueries.ts';

// Phones show one part of the page at a time; wide screens show everything side by side
const DM_TABS = [
    { id: 'turns', label: 'Initiative' },
    { id: 'party', label: 'Party' },
    { id: 'encounter', label: 'Encounter' },
    { id: 'notes', label: 'Notes' },
    { id: 'rolls', label: 'Rolls' },
] as const;
type DmTab = (typeof DM_TABS)[number]['id'];

const messageOf = (err: unknown) => (err instanceof ApiError || err instanceof Error ? err.message : 'Something went wrong');

// HP bar colors match the sheet's Health block
function HpBar({ current, max, label }: { current: number; max: number; label: string }) {
    const percent = max > 0 ? Math.max(0, Math.min(100, Math.round((current / max) * 100))) : 0;
    const color = percent > 50 ? '#5c9a52' : percent > 25 ? '#d9a13b' : '#c4553f';
    return (
        <div className={sheet.bar} role="meter" aria-valuemin={0} aria-valuemax={max} aria-valuenow={current} aria-label={label}>
            <div className={sheet.barFill} style={{ width: `${percent}%`, background: color }} />
        </div>
    );
}

// An amount, then Damage or Heal
function QuickHp({ name, onHp }: { name: string; onHp: (action: 'heal' | 'damage', amount: number) => void }) {
    const [amount, setAmount] = useState('');
    const n = Number(amount);
    const valid = Number.isInteger(n) && n > 0;
    const apply = (action: 'heal' | 'damage') => { if (valid) { onHp(action, n); setAmount(''); } };
    return (
        <div className={styles.quick}>
            <input className={`${sheet.input} ${styles.quickInput}`} type="number" min={1} value={amount} aria-label={`Amount for ${name}`}
                onChange={(e) => setAmount(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') apply('damage'); }} />
            <button type="button" className={`${sheet.button} ${sheet.damage}`} disabled={!valid} aria-label={`Damage ${name}`} onClick={() => apply('damage')}>−</button>
            <button type="button" className={`${sheet.button} ${sheet.heal}`} disabled={!valid} aria-label={`Heal ${name}`} onClick={() => apply('heal')}>+</button>
        </div>
    );
}

function Conditions({ list }: { list: string[] }) {
    if (list.length === 0) return null;
    return <div className={sheet.chips}>{list.map((c) => <span key={c} className={`${sheet.chip} ${sheet.chipOn}`}>{c}</span>)}</div>;
}

function PartyBlock({ party, onHp }: { party: PartyMember[]; onHp: (id: number, action: 'heal' | 'damage', amount: number) => void }) {
    return (
        <section className={sheet.block} aria-label="Party">
            <h2 className={sheet.heading}>Party</h2>
            {party.length === 0 && <span className={sheet.muted}>No player has picked a character for this campaign yet.</span>}
            {party.map((p) => (
                <div key={p.id} className={styles.member}>
                    <img className={styles.thumb} src={p.portrait ?? '/default-character.png'} alt="" />
                    <div className={styles.memberBody}>
                        <span className={sheet.rowName}><Link to={`/characters/${p.id}`}>{p.name}</Link></span>
                        <span className={sheet.muted}>
                            {[p.username, p.role ? `${p.role} ${p.level}` : `Level ${p.level}`, `Armor ${p.armor}`].join(' · ')}
                        </span>
                        <span>{p.hp.current} / {p.hp.max}{p.hp.temp > 0 && <span className={sheet.muted}> +{p.hp.temp} ward</span>}</span>
                        <HpBar current={p.hp.current} max={p.hp.max} label={`${p.name} health`} />
                        <Conditions list={p.conditions} />
                        <QuickHp name={p.name} onHp={(action, amount) => onHp(p.id, action, amount)} />
                    </div>
                </div>
            ))}
        </section>
    );
}

function EncounterBlock({ encounter, onHp, onAdd, onRemove, busy }: {
    encounter: EncounterMonster[];
    onHp: (id: number, action: 'heal' | 'damage', amount: number) => void;
    onAdd: (monsterId: number, nickname: string) => void;
    onRemove: (id: number) => void;
    busy: boolean;
}) {
    const catalog = useMonsterCatalog();
    const [pick, setPick] = useState('');
    const [nickname, setNickname] = useState('');
    return (
        <section className={sheet.block} aria-label="Encounter">
            <h2 className={sheet.heading}>Encounter</h2>
            <div className={styles.quick}>
                <select className={`${sheet.input} ${styles.field}`} value={pick} aria-label="Monster to add" onChange={(e) => setPick(e.target.value)}>
                    <option value="">Choose a monster…</option>
                    {(catalog.data ?? []).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
                <input className={`${sheet.input} ${styles.field}`} type="text" maxLength={60} placeholder="Nickname (optional)" value={nickname}
                    aria-label="Nickname" onChange={(e) => setNickname(e.target.value)} />
                <button type="button" className={`${sheet.button} ${sheet.primary}`} disabled={!pick || busy}
                    onClick={() => { onAdd(Number(pick), nickname); setPick(''); setNickname(''); }}>Add monster</button>
            </div>
            {encounter.length === 0 && <span className={sheet.muted}>No monsters in this campaign yet.</span>}
            {encounter.map((m) => (
                <div key={m.id} className={styles.member}>
                    <img className={styles.thumb} src={m.portrait ?? '/default-character.png'} alt="" />
                    <div className={styles.memberBody}>
                        <span className={sheet.rowName}><Link to={`/monsters/${m.id}`}>{m.name}</Link></span>
                        <span className={sheet.muted}>
                            {[m.name !== m.monsterName ? m.monsterName : null, m.health, `Armor ${m.armor}`].filter(Boolean).join(' · ')}
                        </span>
                        <span>{m.hp.current} / {m.hp.max}{m.hp.temp > 0 && <span className={sheet.muted}> +{m.hp.temp} ward</span>}</span>
                        <HpBar current={m.hp.current} max={m.hp.max} label={`${m.name} health`} />
                        <Conditions list={m.conditions} />
                        <div className={styles.quick}>
                            <QuickHp name={m.name} onHp={(action, amount) => onHp(m.id, action, amount)} />
                            <button type="button" className={sheet.button} aria-label={`Remove ${m.name}`}
                                onClick={() => { if (window.confirm(`Remove ${m.name} from the campaign?`)) onRemove(m.id); }}>Remove</button>
                        </div>
                    </div>
                </div>
            ))}
        </section>
    );
}

function InitiativeBlock({ data, onOp, busy }: { data: DmPageData; onOp: (op: 'roll' | 'next' | 'clear') => void; busy: boolean }) {
    const init = data.initiative;
    return (
        <section className={sheet.block} aria-label="Initiative">
            <div className={sheet.hpLine}>
                <h2 className={sheet.heading}>Initiative</h2>
                {init && <span className={sheet.muted}>Round {init.round}</span>}
            </div>
            {!init && <span className={sheet.muted}>No fight running. Roll to sort everyone in the party and the encounter.</span>}
            {init?.order.map((e, i) => (
                <div key={`${e.kind}-${e.id}`} className={`${styles.turn} ${i === init.turn ? styles.turnNow : ''}`} aria-current={i === init.turn ? 'step' : undefined}>
                    <span>{e.name}</span>
                    <span>{e.roll}</span>
                </div>
            ))}
            <div className={styles.quick}>
                <button type="button" className={`${sheet.button} ${sheet.primary}`} disabled={busy} onClick={() => onOp('roll')}>{init ? 'Re-roll' : 'Roll initiative'}</button>
                <button type="button" className={sheet.button} disabled={busy || !init} onClick={() => onOp('next')}>Next turn</button>
                <button type="button" className={sheet.button} disabled={busy || !init} onClick={() => onOp('clear')}>End fight</button>
            </div>
        </section>
    );
}

function NotesBlock({ saved, onSave, saving }: { saved: string; onSave: (notes: string) => void; saving: boolean }) {
    const [notes, setNotes] = useState(saved);
    useEffect(() => setNotes(saved), [saved]);
    return (
        <section className={sheet.block} aria-label="DM notes">
            <h2 className={sheet.heading}>Notes</h2>
            <textarea className={`${sheet.input} ${styles.notes}`} maxLength={20000} value={notes} aria-label="DM notes"
                placeholder="Only you see these." onChange={(e) => setNotes(e.target.value)} />
            <button type="button" className={sheet.button} disabled={saving || notes === saved} onClick={() => onSave(notes)}>
                {saving ? 'Saving…' : 'Save notes'}
            </button>
        </section>
    );
}

export default function DmPage() {
    const { campId = '' } = useParams();
    const page = useDmPage(campId);
    const change = useDmChange(campId);
    const [feed, setFeed] = useState<FeedEntry[]>([]);
    const nextId = useRef(1);
    const [tab, setTab] = useState<DmTab>('turns');
    useHeaderStatusBar(); // the phone's status bar matches the header

    // One part of the page; on phones only the chosen tab's part shows (DmPage.module.css)
    const pane = (id: DmTab) => (tab === id ? styles.pane : `${styles.pane} ${styles.paneHidden}`);

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

    if (page.isPending) return <Loader />;
    if (page.error) return <p className={sheet.error} role="alert">{messageOf(page.error)}</p>;

    const data = page.data;
    const error = [change.hp.error, change.initiative.error, change.notes.error, change.addMonster.error, change.removeMonster.error].find(Boolean);

    return (
        <>
            <header id={layout.siteTitle}>
                <img src="/Logo.png" alt="Eldrid Tales Logo" className={layout.titleLogo} />
            </header>

            <div className={`${sheet.page} ${styles.area}`}>
                <p className={`${sheet.muted} ${styles.crumbs}`}>
                    <Link to={`/campaign/${data.campaign.id}`}>{data.campaign.name}</Link> · DM page
                </p>
                <nav className={styles.tabs} aria-label="DM page parts">
                    {DM_TABS.map((t) => (
                        <button key={t.id} type="button" className={tab === t.id ? sheet.tabActive : sheet.tab}
                            aria-pressed={tab === t.id} onClick={() => setTab(t.id)}>{t.label}</button>
                    ))}
                </nav>
                {error && <p className={sheet.error} role="alert">{messageOf(error)}</p>}
                <div className={styles.layout}>
                    <div className={sheet.stack}>
                        <div className={pane('turns')}>
                            <InitiativeBlock data={data} busy={change.initiative.isPending} onOp={(op) => change.initiative.mutate(op)} />
                        </div>
                        <div className={pane('notes')}>
                            <NotesBlock saved={data.notes} saving={change.notes.isPending} onSave={(notes) => change.notes.mutate(notes)} />
                        </div>
                        <div className={pane('rolls')}>
                            <RollFeed entries={feed} />
                        </div>
                    </div>
                    <div className={sheet.stack}>
                        <div className={pane('party')}>
                            <PartyBlock party={data.party} onHp={(id, action, amount) => change.hp.mutate({ kind: 'character', id, action, amount })} />
                        </div>
                        <div className={pane('encounter')}>
                            <EncounterBlock encounter={data.encounter} busy={change.addMonster.isPending}
                                onHp={(id, action, amount) => change.hp.mutate({ kind: 'monster', id, action, amount })}
                                onAdd={(monster_id, nickname) => change.addMonster.mutate({ monster_id, nickname: nickname.trim() || undefined })}
                                onRemove={(id) => change.removeMonster.mutate(id)} />
                        </div>
                    </div>
                </div>
            </div>

            <footer className={layout.footer}>
                <p>copyrite Eldrid Tales LLC</p>
            </footer>
        </>
    );
}
