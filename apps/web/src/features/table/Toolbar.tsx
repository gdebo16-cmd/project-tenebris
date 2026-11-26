import { type SceneData, type Token, type Brush } from './tableQueries.ts'
import { type Tool, PAINT_TOOLS, BRUSHES } from './tableTypes.ts'
import { type SceneLook, TERRAIN_KINDS, type Surface, MAX_HEIGHT, SURFACES, FEATURE_KINDS, SCENE_MOODS, SCENE_WEATHERS } from '@tenebris/rules/board'
import { type ReactNode, useState } from 'react'
import { type AreaKind } from '@tenebris/rules/sight'
import { ShapeControls } from './ShapePanels.tsx'
import { SURFACE_LOOK } from './TableScenery.tsx'
import { FEATURE_LOOK } from './BoardFeatures.tsx'
import { Room } from './BoardWorld.tsx'
import { Fog } from './BoardActs.tsx'
import styles from './Toolbar.module.css'
import controls from './TableControls.module.css'

// The tools above the board. Players see only their status line; the DM gets brushes, Place and Remove.
export function Toolbar(props: {
    mode: 'session' | 'editor';
    data: SceneData | undefined;
    tool: Tool; setTool: (t: Tool) => void;
    placing: string; setPlacing: (v: string) => void;
    summonName: string; setSummonName: (v: string) => void;
    summonOwner: string; setSummonOwner: (v: string) => void;
    selectedToken: Token | null;
    onRemove: () => void;
    look: SceneLook;
    onLook: (change: Partial<SceneLook>) => void;
    onResetFog: () => void;
    onClearMap: () => void;
    brush: number; setBrush: (b: number) => void;
    message: string;
    children?: ReactNode;
}) {
    const { data, tool, setTool, selectedToken, message } = props;
    const isDm = data?.isDm ?? false;
    const pressed = (t: Tool) => tool.type === t.type && (t.type !== 'paint' || (tool.type === 'paint' && tool.terrain === t.terrain));
    const button = (label: string, t: Tool) => (
        <button type="button" className={pressed(t) ? `${controls.tool} ${controls.toolOn}` : controls.tool}
            aria-pressed={pressed(t)} onClick={() => setTool(t)}>{label}</button>
    );

    const status = message
        || (selectedToken ? `${selectedToken.name}: click a hex to move there` : '')
        || (tool.type === 'scene' ? (props.mode === 'editor' ? "This board's look when it's put on the table" : 'Change the mood for everyone at the table') : '')
        || (tool.type === 'measure' ? 'Drag from one hex to another to measure' : '')
        || (isDm && PAINT_TOOLS.includes(tool.type) ? 'Click or drag to paint · right-drag turns the camera' : '')
        || (tool.type === 'move' ? 'Click your token, then a hex' : tool.type === 'place' ? 'Click a hex to place it' : tool.type === 'surface' ? 'Click hexes to change the ground' : tool.type === 'feature' ? (tool.kind ? 'Click a hex to place it' : 'Click a feature to remove it') : 'Click hexes to paint');

    const shapeTool = tool.type === 'shape' ? tool : { type: 'shape' as const, kind: 'circle' as AreaKind, sizeFt: 10, turns: 0, name: '' };
    return (
        <div className={styles.toolbar} aria-label="Table tools">
            {/* players: move their tokens, draw shapes (spell areas, a wall of fire...), measure */}
            {!isDm && (
                <div className={controls.row}>
                    {button('Move', { type: 'move' })}
                    {button('Shapes', shapeTool)}
                    {button('Measure', { type: 'measure' })}
                </div>
            )}
            {tool.type === 'shape' && <ShapeControls tool={tool} setTool={setTool} />}
            {isDm && (
                <>
                    {props.mode === 'editor' ? (
                        // Map Editor: building the board
                        <div className={controls.row}>
                            {button('Move', { type: 'move' })}
                            {TERRAIN_KINDS.map((kind) => <span key={kind}>{button(kind[0].toUpperCase() + kind.slice(1), { type: 'paint', terrain: kind })}</span>)}
                            {button('Eraser', { type: 'erase' })}
                            {button('Surface', { type: 'surface', surface: tool.type === 'surface' ? tool.surface : 'cobble' })}
                            {button('Features', tool.type === 'feature' ? tool : { type: 'feature', kind: 'tree', size: 1, color: '#ffd08a' })}
                            {button('Height', tool.type === 'height' ? tool : { type: 'height', height: 1 })}
                            {button('Place', { type: 'place' })}
                            {button('Look', { type: 'scene' })}
                        </div>
                    ) : (
                        // Play Session: running the game
                        <div className={controls.row}>
                            {button('Move', { type: 'move' })}
                            {button('Place', { type: 'place' })}
                            {button('Shapes', shapeTool)}
                            {button('Measure', { type: 'measure' })}
                            {button('Scene', { type: 'scene' })}
                        </div>
                    )}
                    {/* the Height brush: how many levels up (0 = back to flat) */}
                    {tool.type === 'height' && (
                        <div className={controls.row}>
                            {Array.from({ length: MAX_HEIGHT + 1 }, (_, h) => (
                                <button key={h} type="button" aria-pressed={tool.height === h}
                                    className={tool.height === h ? `${controls.tool} ${controls.toolOn}` : controls.tool}
                                    onClick={() => setTool({ type: 'height', height: h })}>{h === 0 ? 'Flat' : `Up ${h}`}</button>
                            ))}
                        </div>
                    )}
                    {tool.type === 'scene' && <SceneControls mode={props.mode} look={props.look} onLook={props.onLook} onResetFog={props.onResetFog} onClearMap={props.onClearMap} />}
                    {/* the brush for every paint tool: one hex, or a ring or two around it */}
                    {PAINT_TOOLS.includes(tool.type) && (
                        <div className={controls.row}>
                            <span className={controls.field}>Brush:</span>
                            {BRUSHES.map(([label, rings]) => (
                                <button key={rings} type="button" aria-pressed={props.brush === rings}
                                    className={props.brush === rings ? `${controls.tool} ${controls.toolOn}` : controls.tool}
                                    onClick={() => props.setBrush(rings)}>{label}</button>
                            ))}
                        </div>
                    )}
                    {/* the Surface brush: one button per kind of ground, with a little picture of it */}
                    {tool.type === 'surface' && (
                        <div className={controls.row}>
                            {SURFACES.map((s) => (
                                <button key={s} type="button" aria-pressed={tool.surface === s}
                                    className={tool.surface === s ? `${controls.tool} ${controls.toolOn}` : controls.tool}
                                    onClick={() => setTool({ type: 'surface', surface: s })}>
                                    <span className={styles.swatch} data-surface={s} aria-hidden="true" />
                                    {SURFACE_LOOK[s].label}
                                </button>
                            ))}
                            <button type="button" aria-pressed={tool.surface === null}
                                className={tool.surface === null ? `${controls.tool} ${controls.toolOn}` : controls.tool}
                                onClick={() => setTool({ type: 'surface', surface: null })}>Clear</button>
                        </div>
                    )}
                    {/* the Features brush: what to place, its size, and a light's colour */}
                    {tool.type === 'feature' && (
                        <div className={controls.row}>
                            {FEATURE_KINDS.map((k) => (
                                <button key={k} type="button" aria-pressed={tool.kind === k}
                                    className={tool.kind === k ? `${controls.tool} ${controls.toolOn}` : controls.tool}
                                    onClick={() => setTool({ ...tool, kind: k })}>{FEATURE_LOOK[k].label}</button>
                            ))}
                            <button type="button" aria-pressed={tool.kind === null}
                                className={tool.kind === null ? `${controls.tool} ${controls.toolOn}` : controls.tool}
                                onClick={() => setTool({ ...tool, kind: null })}>Remove</button>
                            <label className={controls.field}>Size{' '}
                                <input className={styles.inputRange} type="range" min={0.5} max={2} step={0.1} value={tool.size}
                                    onChange={(e) => setTool({ ...tool, size: Number(e.target.value) })} />
                            </label>
                            {tool.kind === 'light' && (
                                <label className={controls.field}>Colour{' '}
                                    <input className={styles.inputColor} type="color" value={tool.color} onChange={(e) => setTool({ ...tool, color: e.target.value })} />
                                </label>
                            )}
                        </div>
                    )}
                    {tool.type === 'place' && (
                        <div className={controls.row}>
                            <select className={controls.select} value={props.placing} aria-label="What to place" onChange={(e) => props.setPlacing(e.target.value)}>
                                <option className={controls.option} value="">Choose…</option>
                                <optgroup label="Party">
                                    {data?.placeable?.party.map((p) => <option className={controls.option} key={p.characterId} value={`character:${p.characterId}`}>{p.name} ({p.username})</option>)}
                                </optgroup>
                                <optgroup label="Monsters">
                                    {data?.placeable?.monsters.map((m) => <option className={controls.option} key={m.id} value={`monster:${m.id}`}>{m.name}</option>)}
                                </optgroup>
                                <option className={controls.option} value="summon">A summon or pet…</option>
                            </select>
                            {props.placing === 'summon' && (
                                <>
                                    <input className={controls.input} type="text" maxLength={60} placeholder="Summon's name" aria-label="Summon's name"
                                        value={props.summonName} onChange={(e) => props.setSummonName(e.target.value)} />
                                    <select className={controls.select} value={props.summonOwner} aria-label="Summon's owner" onChange={(e) => props.setSummonOwner(e.target.value)}>
                                        <option className={controls.option} value="">Owner: the DM</option>
                                        {data?.placeable?.party.map((p) => <option className={controls.option} key={p.ownerId} value={p.ownerId}>Owner: {p.username}</option>)}
                                    </select>
                                </>
                            )}
                        </div>
                    )}
                    {selectedToken && (
                        <div className={controls.row}>
                            <button type="button" className={controls.tool} onClick={props.onRemove}>Remove {selectedToken.name}</button>
                        </div>
                    )}
                </>
            )}
            {props.children}
            <p className={message ? `${controls.status} ${styles.error}` : controls.status} role={message ? 'alert' : 'status'}>{status}</p>
        </div>
    );
}

export const titled = (word: string) => word[0].toUpperCase() + word.slice(1);

// The DM's Scene controls. Each change goes to the server at once, and every screen at the table follows.
function SceneControls({ mode, look, onLook, onResetFog, onClearMap }: { mode: 'session' | 'editor'; look: SceneLook; onLook: (change: Partial<SceneLook>) => void; onResetFog: () => void; onClearMap: () => void }) {
    const editing = mode === 'editor';
    const [sure, setSure] = useState(false);
    const [url, setUrl] = useState(look.map?.url ?? '');
    const [size, setSize] = useState(look.map?.size ?? 30);
    return (
        <>
            <div className={controls.row}>
                <div className={styles.moodSelect}>
                    {SCENE_MOODS.map((m) => <button aria-pressed={look.mood === m} onClick={(e) => onLook({ mood: m })} key={m} type="button" className={controls.tool} value={m}>{titled(m)}</button>)}
                </div>
                <div className={styles.weatherSelect}>
                    {SCENE_WEATHERS.map((w) => <button aria-pressed={look.weather === w} onClick={(e) => onLook({ weather: w })} key={w} type="button" className={controls.tool} value={w}>{titled(w)}</button>)}
                </div>
                <div className={styles.roomSelect}>
                    <button aria-pressed={look.room ?? false} onClick={(e) => onLook({ room: !look.room })} key="room" type="button" className={controls.tool}> Room and candles</button>
                </div>
                {!editing && (
                        <button type="button" aria-pressed={look.fog ?? false} className={controls.tool} onClick={(e) => onLook({ fog: !look.fog })}> Fog</button>
                )}
                {!editing && look.fog && <button type="button" className={controls.tool} onClick={onResetFog}>Cover the map again</button>}
                {!editing ? null : sure ? (
                    <>
                        <button type="button" className={`${controls.tool} ${styles.toolDanger}`} onClick={() => { setSure(false); onClearMap(); }}>Yes, clear everything</button>
                        <button type="button" className={controls.tool} onClick={() => setSure(false)}>Keep it</button>
                    </>
                ) : <button type="button" className={controls.tool} onClick={() => setSure(true)}>Clear map</button>}
            </div>
            {editing && (
                <form className={controls.row} onSubmit={(e) => { e.preventDefault(); onLook({ map: { url: url.trim(), size } }); }}>
                    <input className={controls.input} type="url" placeholder="Map picture link (https://…)" aria-label="Map picture link"
                        value={url} onChange={(e) => setUrl(e.target.value)} />
                    <label className={controls.field}>Width{' '}
                        <input className={styles.inputRange} type="range" min={10} max={80} step={1} value={size} onChange={(e) => setSize(Number(e.target.value))} />
                    </label>
                    <button type="submit" className={controls.tool} disabled={!url.trim()}>Show map</button>
                    {look.map && <button type="button" className={controls.tool} onClick={() => { setUrl(''); onLook({ map: null }); }}>Remove map</button>}
                </form>
            )}
        </>
    );
}
