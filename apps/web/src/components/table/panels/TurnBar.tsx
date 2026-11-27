// The turn bar (Stage 2 polish): portraits across the top of the TV in initiative order, the current one big and lit,
// turning round as the fight goes on. Everyone sees it; it shows names and pictures only (no rolls, no monster HP).
import type { Token, Turns } from '../../../features/table/hooks/tableQueries.ts'
import styles from '../../../styles/components/table/panels/TurnBar.module.css'

type Entry = Turns['order'][number];

// Which token on the board is this creature (characters by their character, monsters by the campaign's monster)
export function tokenFor(entry: Entry, tokens: Token[]) {
    return tokens.find((t) => entry.kind === 'character' ? t.characterId === entry.id : t.monsterId === entry.id) ?? null;
}

export function TurnBar({ turns, tokens }: { turns: Turns | null; tokens: Token[] }) {
    if (!turns || turns.order.length === 0) return null;
    const n = turns.order.length;
    // start the row at whoever's turn it is, then the ones after them, wrapping round
    const rotated = Array.from({ length: n }, (_, i) => turns.order[(turns.turn + i) % n]);
    return (
        <div className={styles.bar} aria-label={`Round ${turns.round}, turn order`}>
            <span className={styles.round}>Round {turns.round}</span>
            <ol className={styles.list}>
                {rotated.map((entry, i) => {
                    const token = tokenFor(entry, tokens);
                    const down = token?.health === 'Down';
                    const cls = [styles.face, i === 0 && styles.current, entry.kind === 'monster' && styles.monster, down && styles.down]
                        .filter(Boolean).join(' ');
                    return (
                        // the key is the creature, so the browser slides each portrait to its new place rather than redrawing
                        <li key={`${entry.kind}:${entry.id}`} className={cls} aria-current={i === 0 ? 'true' : undefined}>
                            {token?.portrait
                                ? <img src={token.portrait} alt="" className={styles.picture} />
                                : <span className={styles.letter} aria-hidden="true">{(entry.name.trim()[0] ?? '?').toUpperCase()}</span>}
                            <span className={styles.name}>{entry.name}</span>
                        </li>
                    );
                })}
            </ol>
        </div>
    );
}
