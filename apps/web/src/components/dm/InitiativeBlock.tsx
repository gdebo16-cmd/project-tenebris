import sheet from '../../styles/components/sheets/Sheet.module.css';
import styles from '../../styles/features/dm/DmPage.module.css';
import { useDmTools } from './DmContext.tsx';
import { ErrorLine } from './DmBlockParts.tsx';

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
