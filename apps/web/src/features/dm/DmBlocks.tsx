// The DM page's own blocks (placed by its layout, like a sheet's): Initiative, Notes, the table's Rolls, Party and
// Encounter. They read the DM context (DmContext.tsx). The server rolls initiative and every attack; HP changes go
// through the sheets' own routes. In Party and Encounter, "Show" makes that creature the current one (until the
// turn moves on), for the "current player" / "current monster" blocks.
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ApiError } from '../../api.ts';
import sheet from '../../styles/components/sheets/Sheet.module.css';
import styles from './DmPage.module.css';
import RollFeed from '../../components/sheets/blocks/RollFeed.tsx';
import { useMonsterCatalog } from './dmQueries.ts';
import { useDmTools } from './DmContext.tsx';

const messageOf = (err: unknown) => (err instanceof ApiError || err instanceof Error ? err.message : 'Something went wrong');

function ErrorLine({ errors }: { errors: unknown[] }) {
    const error = errors.find(Boolean);
    return error ? <p className={sheet.error} role="alert">{messageOf(error)}</p> : null;
}

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

// "Show": make this creature the current one (pressed when it is)
function ShowButton({ name, current, onShow }: { name: string; current: boolean; onShow: () => void }) {
    return (
        <button type="button" className={current ? `${styles.show} ${styles.showOn}` : styles.show} aria-pressed={current}
            aria-label={`Show ${name} in the current blocks`} onClick={onShow}>{current ? 'Shown' : 'Show'}</button>
    );
}

export function InitiativeBlock() {
    const { data, change } = useDmTools();
    const init = data.initiative;
    const busy = change.initiative.isPending;
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
                <button type="button" className={`${sheet.button} ${sheet.primary}`} disabled={busy} onClick={() => change.initiative.mutate('roll')}>{init ? 'Re-roll' : 'Roll initiative'}</button>
                <button type="button" className={sheet.button} disabled={busy || !init} onClick={() => change.initiative.mutate('next')}>Next turn</button>
                <button type="button" className={sheet.button} disabled={busy || !init} onClick={() => change.initiative.mutate('clear')}>End fight</button>
            </div>
            <ErrorLine errors={[change.initiative.error]} />
        </section>
    );
}

export function NotesBlock() {
    const { data, change } = useDmTools();
    const [notes, setNotes] = useState(data.notes);
    useEffect(() => setNotes(data.notes), [data.notes]);
    const saving = change.notes.isPending;
    return (
        <section className={`${sheet.block} ${styles.fillBlock}`} aria-label="DM notes">
            <h2 className={sheet.heading}>Notes</h2>
            <textarea className={`${sheet.input} ${styles.notes}`} maxLength={20000} value={notes} aria-label="DM notes"
                placeholder="Only you see these." onChange={(e) => setNotes(e.target.value)} />
            <button type="button" className={sheet.button} disabled={saving || notes === data.notes} onClick={() => change.notes.mutate(notes)}>
                {saving ? 'Saving…' : 'Save notes'}
            </button>
            <ErrorLine errors={[change.notes.error]} />
        </section>
    );
}

export function TableRollsBlock() {
    return <RollFeed entries={useDmTools().feed} />;
}

export function PartyBlock() {
    const { data, change, playerId, pickPlayer } = useDmTools();
    return (
        <section className={sheet.block} aria-label="Party">
            <h2 className={sheet.heading}>Party</h2>
            {data.party.length === 0 && <span className={sheet.muted}>No player has picked a character for this campaign yet.</span>}
            {data.party.map((p) => (
                <div key={p.id} className={p.id === playerId ? `${styles.member} ${styles.memberCurrent}` : styles.member}>
                    <img className={styles.thumb} src={p.portrait ?? '/default-character.png'} alt="" />
                    <div className={styles.memberBody}>
                        <div className={styles.memberTop}>
                            <span className={sheet.rowName}><Link to={`/characters/${p.id}`}>{p.name}</Link></span>
                            <ShowButton name={p.name} current={p.id === playerId} onShow={() => pickPlayer(p.id)} />
                        </div>
                        <span className={sheet.muted}>
                            {[p.username, p.role ? `${p.role} ${p.level}` : `Level ${p.level}`, `Armor ${p.armor}`].join(' · ')}
                        </span>
                        <span>{p.hp.current} / {p.hp.max}{p.hp.temp > 0 && <span className={sheet.muted}> +{p.hp.temp} ward</span>}</span>
                        <HpBar current={p.hp.current} max={p.hp.max} label={`${p.name} health`} />
                        <Conditions list={p.conditions} />
                        <QuickHp name={p.name} onHp={(action, amount) => change.hp.mutate({ kind: 'character', id: p.id, action, amount })} />
                    </div>
                </div>
            ))}
            <ErrorLine errors={[change.hp.error]} />
        </section>
    );
}

export function EncounterBlock() {
    const { data, change, monsterId, pickMonster } = useDmTools();
    const catalog = useMonsterCatalog();
    const [pick, setPick] = useState('');
    const [nickname, setNickname] = useState('');
    const busy = change.addMonster.isPending;
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
                    onClick={() => { change.addMonster.mutate({ monster_id: Number(pick), nickname: nickname.trim() || undefined }); setPick(''); setNickname(''); }}>Add monster</button>
            </div>
            {data.encounter.length === 0 && <span className={sheet.muted}>No monsters in this campaign yet.</span>}
            {data.encounter.map((m) => (
                <div key={m.id} className={m.id === monsterId ? `${styles.member} ${styles.memberCurrent}` : styles.member}>
                    <img className={styles.thumb} src={m.portrait ?? '/default-character.png'} alt="" />
                    <div className={styles.memberBody}>
                        <div className={styles.memberTop}>
                            <span className={sheet.rowName}><Link to={`/monsters/${m.id}`}>{m.name}</Link></span>
                            <ShowButton name={m.name} current={m.id === monsterId} onShow={() => pickMonster(m.id)} />
                        </div>
                        <span className={sheet.muted}>
                            {[m.name !== m.monsterName ? m.monsterName : null, m.health, `Armor ${m.armor}`].filter(Boolean).join(' · ')}
                        </span>
                        <span>{m.hp.current} / {m.hp.max}{m.hp.temp > 0 && <span className={sheet.muted}> +{m.hp.temp} ward</span>}</span>
                        <HpBar current={m.hp.current} max={m.hp.max} label={`${m.name} health`} />
                        <Conditions list={m.conditions} />
                        <div className={styles.quick}>
                            <QuickHp name={m.name} onHp={(action, amount) => change.hp.mutate({ kind: 'monster', id: m.id, action, amount })} />
                            <button type="button" className={sheet.button} aria-label={`Remove ${m.name}`}
                                onClick={() => { if (window.confirm(`Remove ${m.name} from the campaign?`)) change.removeMonster.mutate(m.id); }}>Remove</button>
                        </div>
                    </div>
                </div>
            ))}
            <ErrorLine errors={[change.hp.error, change.addMonster.error, change.removeMonster.error]} />
        </section>
    );
}
