import { type Tool, SIZE_WORD, SIZES_FT } from '../../../features/table/hooks/tableTypes.ts'
import { AREA_KINDS } from '@tenebris/rules/sight'
import { titled } from './parts/ToolParts.tsx'
import { Fog } from '../board/overlays/BoardActs.tsx'
import { type Overlay } from '../../../features/table/hooks/tableQueries.ts'
import controls from '../../../styles/components/table/toolbar/TableControls.module.css'

// The Shapes tool: which shape, how big, how long it stays, and its name
export function ShapeControls({ tool, setTool }: { tool: Extract<Tool, { type: 'shape' }>; setTool: (t: Tool) => void }) {
    return (
        <div className={controls.row}>
            {AREA_KINDS.map((k) => (
                <button key={k} type="button" aria-pressed={tool.kind === k}
                    className={tool.kind === k ? `${controls.tool} ${controls.toolOn}` : controls.tool}
                    onClick={() => setTool({ ...tool, kind: k })}>{titled(k)}</button>
            ))}
            <label className={controls.field}>{SIZE_WORD[tool.kind]}{' '}
                <select className={controls.select} value={tool.sizeFt} onChange={(e) => setTool({ ...tool, sizeFt: Number(e.target.value) })}>
                    {SIZES_FT.map((f) => <option className={controls.option} key={f} value={f}>{f} ft</option>)}
                </select>
            </label>
            <label className={controls.field}>Turns{' '}
                <input className={controls.input} type="number" min={0} max={100} value={tool.turns}  title="0 = stays until removed"
                    onChange={(e) => setTool({ ...tool, turns: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })} />
            </label>
            <input className={controls.input} type="text" maxLength={40} placeholder="Name (e.g. Fog Cloud)" aria-label="Shape name"
                value={tool.name} onChange={(e) => setTool({ ...tool, name: e.target.value })} />
        </div>
    );
}

// The shapes on the board, with Remove for your own (the DM can remove any)
export function ShapeList({ overlays, userId, isDm, onRemove }: { overlays: Overlay[]; userId: number; isDm: boolean; onRemove: (id: number) => void }) {
    if (overlays.length === 0) return null;
    return (
        <div className={controls.row}>
            {overlays.map((o) => (
                <span key={o.id} className={controls.field}>
                    {o.name}{o.turnsLeft != null ? ` (${o.turnsLeft})` : ''}
                    {(isDm || o.ownerId === userId) && (
                        <button type="button" className={controls.tool} onClick={() => onRemove(o.id)} aria-label={`Remove ${o.name}`}>×</button>
                    )}
                </span>
            ))}
        </div>
    );
}
