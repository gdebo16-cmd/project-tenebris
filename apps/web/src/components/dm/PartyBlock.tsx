import { Link } from 'react-router';
import sheet from '../../styles/components/sheets/Sheet.module.css';
import styles from '../../styles/features/dm/DmPage.module.css';
import { useDmTools } from './DmContext.tsx';
import { Conditions, ErrorLine, HpBar, QuickHp, ShowButton } from './DmBlockParts.tsx';

export function PartyBlock() {
    const { data, change, playerId, pickPlayer } = useDmTools();
    return (
        <section className={sheet.block} aria-label="Party">
            <h2 className={sheet.heading}>Party</h2>
            {data.party.length === 0 && <span className={sheet.muted}>No player has picked a character for this campaign yet.</span>}
            {data.party.map((p) => (
                <div key={p.id} className={p.id === playerId ? `${styles.member} ${styles.memberCurrent}` : styles.member}>
                    <img className={styles.thumb} src={p.portrait ?? '/images/default-character.png'} alt="" />
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
