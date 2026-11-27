import { useState } from 'react';
import { Link } from 'react-router';
import sheet from '../../styles/components/sheets/Sheet.module.css';
import styles from '../../styles/features/dm/DmPage.module.css';
import { useMonsterCatalog } from '../../features/dm/dmQueries.ts';
import { useDmTools } from './DmContext.tsx';
import { Conditions, ErrorLine, HpBar, QuickHp, ShowButton } from './DmBlockParts.tsx';

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
                    <img className={styles.thumb} src={m.portrait ?? '/images/default-character.png'} alt="" />
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
