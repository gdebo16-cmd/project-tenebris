import { type Token, useTokenActions } from './tableQueries.ts'
import { type Acting, SIZE_WORD, SIZES_FT } from './tableTypes.ts'
import { messageOf } from './tableUtils.ts'
import { type ActChoice } from '@tenebris/rules/combat'
import { type Area, AREA_KINDS } from '@tenebris/rules/sight'
import { titled } from './Toolbar.tsx'
import controls from './TableControls.module.css'

// The selected token's actions: pick one, then (for spells) the level and a target or an area
export function ActPanel({ token, acting, setActing }: { token: Token; acting: Acting | null; setActing: (a: Acting | null) => void }) {
    const { data, error } = useTokenActions(token.id);
    if (error) return <p className={controls.status}>{messageOf(error)}</p>;
    if (!data) return null;
    const pick = (c: ActChoice) => setActing(acting?.choice.key === c.key ? null
        : { choice: c, castLevel: c.baseLevel, mode: 'target', kind: 'circle', sizeFt: 10, keepTurns: 0 });
    const left = (level: number) => (data.slots[level - 1] ?? 0) - Number(data.usedSlots[level] ?? 0);
    const levels = acting?.choice.kind === 'spell' && acting.choice.baseLevel
        ? Array.from({ length: 10 - acting.choice.baseLevel }, (_, i) => acting.choice.baseLevel! + i).filter((l) => (data.slots[l - 1] ?? 0) > 0)
        : [];
    return (
        <>
            <div className={controls.row}>
                <span className={controls.field}>Act:</span>
                {data.choices.map((c) => (
                    <button  key={c.key} type="button" title={`${c.detail} · ${c.rangeFt ? `${c.rangeFt} ft` : 'self'}`}
                        aria-pressed={acting?.choice.key === c.key}
                        className={acting?.choice.key === c.key ? `${controls.tool} ${controls.toolOn}` : controls.tool}
                        onClick={() => pick(c)}>{c.name}</button>
                ))}
                {data.choices.length === 0 && <span className={controls.field}>Nothing to act with</span>}
            </div>
            {acting && acting.choice.kind === 'spell' && (
                <div className={controls.row}>
                    {levels.length > 0 && (
                        <label className={controls.field}>Level{' '}
                            <select className={controls.select} value={acting.castLevel ?? ''} onChange={(e) => setActing({ ...acting, castLevel: Number(e.target.value) })}>
                                {levels.map((l) => <option className={controls.option} key={l} value={l}>{l} ({left(l)} left)</option>)}
                            </select>
                        </label>
                    )}
                    {(['target', 'area'] as const).map((m) => (
                        <button key={m} type="button" aria-pressed={acting.mode === m}
                            className={acting.mode === m ? `${controls.tool} ${controls.toolOn}` : controls.tool}
                            onClick={() => setActing({ ...acting, mode: m })}>{m === 'target' ? 'One target' : 'Area'}</button>
                    ))}
                    {acting.mode === 'area' && (
                        <>
                            {AREA_KINDS.map((k) => (
                                <button key={k} type="button" aria-pressed={acting.kind === k}
                                    className={acting.kind === k ? `${controls.tool} ${controls.toolOn}` : controls.tool}
                                    onClick={() => setActing({ ...acting, kind: k })}>{titled(k)}</button>
                            ))}
                            <label className={controls.field}>{SIZE_WORD[acting.kind]}{' '}
                                <select className={controls.select} value={acting.sizeFt} onChange={(e) => setActing({ ...acting, sizeFt: Number(e.target.value) })}>
                                    {SIZES_FT.map((f) => <option className={controls.option} key={f} value={f}>{f} ft</option>)}
                                </select>
                            </label>
                            <label className={controls.field}>Stays{' '}
                                <input className={controls.input} type="number" min={0} max={100} value={acting.keepTurns} 
                                    onChange={(e) => setActing({ ...acting, keepTurns: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })} /> turns
                            </label>
                        </>
                    )}
                </div>
            )}
        </>
    );
}
