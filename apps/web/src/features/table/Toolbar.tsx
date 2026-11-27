import { type SceneData, type Token, type Brush } from './tableQueries.ts'
import { type Tool, PAINT_TOOLS, BRUSHES } from './tableTypes.ts'
import { type SceneLook, TERRAIN_KINDS, type Surface, MAX_HEIGHT, SURFACES, FEATURE_KINDS, SCENE_MOODS, SCENE_WEATHERS, BOARD_STYLES, styleOf } from '@tenebris/rules/board'
import { type ReactNode, useState } from 'react'
import { type AreaKind } from '@tenebris/rules/sight'
import { ShapeControls } from './ShapePanels.tsx'
import { SURFACE_LOOK } from './TableScenery.tsx'
import { FEATURE_LOOK } from './BoardFeatures.tsx'
import { Room } from './BoardWorld.tsx'
import { Fog } from './BoardActs.tsx'
import styles from './Toolbar.module.css'
import controls from './TableControls.module.css'

const TOOLS_OPEN_KEY = 'tenebris-board-tools'

function toolsAreOpen() {
    try { return sessionStorage.getItem(TOOLS_OPEN_KEY) !== 'closed' } catch { return true }
}

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
    boardSize?: ReactNode;
    children?: ReactNode;
}) {
    const { data, tool, setTool, selectedToken, message } = props;
    const isDm = data?.isDm ?? false;
    const [open, setOpen] = useState(toolsAreOpen);
    const toggleOpen = () => setOpen((was) => {
        const next = !was;
        try { sessionStorage.setItem(TOOLS_OPEN_KEY, next ? 'open' : 'closed') } catch { /* private mode */ }
        return next;
    });
    const pressed = (t: Tool) => tool.type === t.type && (t.type !== 'paint' || (tool.type === 'paint' && tool.terrain === t.terrain));
    const btnClass = (on: boolean) => on ? `${controls.tool} ${controls.toolOn} ${styles.btn}` : `${controls.tool} ${styles.btn}`;
    const button = (label: string, t: Tool) => (
        <button type="button" className={btnClass(pressed(t))}
            aria-pressed={pressed(t)} onClick={() => setTool(t)}>{label}</button>
    );

    const status = message
        || (selectedToken ? `${selectedToken.name}: click a hex to move there` : '')
        || (tool.type === 'scene' ? (props.mode === 'editor' ? "This board's look when it's put on the table" : 'Change the mood for everyone at the table') : '')
        || (tool.type === 'measure' ? 'Drag from one hex to another to measure' : '')
        || (isDm && PAINT_TOOLS.includes(tool.type) ? 'Click or drag to paint · right-drag turns the camera' : '')
        || (tool.type === 'move' ? 'Click your token, then a hex' : tool.type === 'place' ? 'Click a hex to place it' : tool.type === 'surface' ? 'Click hexes to change the ground' : tool.type === 'feature' ? (tool.kind ? 'Click a hex to place it' : 'Click a feature to remove it') : 'Click hexes to paint');

    const shapeTool = tool.type === 'shape' ? tool : { type: 'shape' as const, kind: 'circle' as AreaKind, sizeFt: 10, turns: 0, name: '' };
    const showTerrain = isDm && (PAINT_TOOLS.includes(tool.type) || tool.type === 'height' || tool.type === 'surface' || tool.type === 'feature');
    const showPlace = isDm && (tool.type === 'place' || !!selectedToken);
    const showLook = isDm && tool.type === 'scene';
    const showBoard = isDm && (tool.type === 'scene' || !!props.boardSize);

    const toolsRow = !isDm ? (
        <div className={styles.btnRow}>
            {button('Move', { type: 'move' })}
            {button('Shapes', shapeTool)}
            {button('Measure', { type: 'measure' })}
        </div>
    ) : props.mode === 'editor' ? (
        <div className={styles.btnRow}>
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
        <div className={styles.btnRow}>
            {button('Move', { type: 'move' })}
            {button('Place', { type: 'place' })}
            {button('Shapes', shapeTool)}
            {button('Measure', { type: 'measure' })}
            {button('Scene', { type: 'scene' })}
        </div>
    );

    return (
        <div className={`${styles.toolbar} ${open ? styles.toolbarOpen : styles.toolbarClosed}`} aria-label="Table tools">
            <div className={styles.header}>
                <h2 className={styles.title}>Board tools</h2>
                <button type="button" className={styles.collapse} aria-expanded={open} aria-controls="board-tools-body"
                    onClick={toggleOpen}>{open ? '▾' : '▸'}</button>
            </div>
            {open && (
                <div id="board-tools-body" className={styles.body}>
                    <section className={styles.section}>
                        <h3 className={styles.sectionTitle}>{isDm && props.mode === 'editor' ? 'Paint tools' : 'Tools'}</h3>
                        {toolsRow}
                    </section>
                    {tool.type === 'shape' && <ShapeControls tool={tool} setTool={setTool} />}
                    {showTerrain && (
                        <section className={styles.section}>
                            <h3 className={styles.sectionTitle}>Terrain</h3>
                            {tool.type === 'height' && (
                                <div className={styles.btnRow}>
                                    {Array.from({ length: MAX_HEIGHT + 1 }, (_, h) => (
                                        <button key={h} type="button" aria-pressed={tool.height === h}
                                            className={btnClass(tool.height === h)}
                                            onClick={() => setTool({ type: 'height', height: h })}>{h === 0 ? 'Flat' : `Up ${h}`}</button>
                                    ))}
                                </div>
                            )}
                            {PAINT_TOOLS.includes(tool.type) && (
                                <div className={styles.btnRow}>
                                    <span className={controls.field}>Brush:</span>
                                    {BRUSHES.map(([label, rings]) => (
                                        <button key={rings} type="button" aria-pressed={props.brush === rings}
                                            className={btnClass(props.brush === rings)}
                                            onClick={() => props.setBrush(rings)}>{label}</button>
                                    ))}
                                </div>
                            )}
                            {tool.type === 'surface' && (
                                <div className={styles.btnRow}>
                                    {SURFACES.map((s) => (
                                        <button key={s} type="button" aria-pressed={tool.surface === s}
                                            className={btnClass(tool.surface === s)}
                                            onClick={() => setTool({ type: 'surface', surface: s })}>
                                            <span className={styles.swatch} data-surface={s} aria-hidden="true" />
                                            {SURFACE_LOOK[s].label}
                                        </button>
                                    ))}
                                    <button type="button" aria-pressed={tool.surface === null}
                                        className={btnClass(tool.surface === null)}
                                        onClick={() => setTool({ type: 'surface', surface: null })}>Clear</button>
                                </div>
                            )}
                            {tool.type === 'feature' && (
                                <div className={styles.btnRow}>
                                    {FEATURE_KINDS.map((k) => (
                                        <button key={k} type="button" aria-pressed={tool.kind === k}
                                            className={btnClass(tool.kind === k)}
                                            onClick={() => setTool({ ...tool, kind: k })}>{FEATURE_LOOK[k].label}</button>
                                    ))}
                                    <button type="button" aria-pressed={tool.kind === null}
                                        className={btnClass(tool.kind === null)}
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
                        </section>
                    )}
                    {showPlace && (
                        <section className={styles.section}>
                            <h3 className={styles.sectionTitle}>Place</h3>
                            {tool.type === 'place' && (
                                <div className={styles.btnRow}>
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
                                <div className={styles.btnRow}>
                                    <button type="button" className={`${controls.tool} ${styles.btn}`} onClick={props.onRemove}>Remove {selectedToken.name}</button>
                                </div>
                            )}
                        </section>
                    )}
                    {showLook && <SceneLookSection mode={props.mode} look={props.look} onLook={props.onLook} onResetFog={props.onResetFog} />}
                    {showBoard && <SceneBoardSection mode={props.mode} look={props.look} onLook={props.onLook} onClearMap={props.onClearMap} showLookControls={showLook} boardSize={props.boardSize} />}
                    {props.children}
                    <p className={message ? `${controls.status} ${styles.error}` : controls.status} role={message ? 'alert' : 'status'}>{status}</p>
                </div>
            )}
        </div>
    );
}

export const titled = (word: string) => word[0].toUpperCase() + word.slice(1);

function btnClass(on: boolean) {
    return on ? `${controls.tool} ${controls.toolOn} ${styles.btn}` : `${controls.tool} ${styles.btn}`;
}

// Mood, weather, room and fog. Each change goes to the server at once, and every screen at the table follows.
function SceneLookSection({ mode, look, onLook, onResetFog }: { mode: 'session' | 'editor'; look: SceneLook; onLook: (change: Partial<SceneLook>) => void; onResetFog: () => void }) {
    const editing = mode === 'editor';
    return (
        <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Look and lighting</h3>
            <div className={styles.btnRow} role="group" aria-label="Mood">
                {SCENE_MOODS.map((m) => (
                    <button aria-pressed={look.mood === m} onClick={() => onLook({ mood: m })} key={m} type="button" className={btnClass(look.mood === m)}>{titled(m)}</button>
                ))}
            </div>
            <div className={styles.btnRow} role="group" aria-label="Weather">
                {SCENE_WEATHERS.map((w) => (
                    <button aria-pressed={look.weather === w} onClick={() => onLook({ weather: w })} key={w} type="button" className={btnClass(look.weather === w)}>{titled(w)}</button>
                ))}
            </div>
            <div className={styles.btnRow}>
                <button aria-pressed={look.room ?? false} onClick={() => onLook({ room: !look.room })} type="button" className={btnClass(look.room ?? false)}>Room and candles</button>
                {!editing && (
                    <button type="button" aria-pressed={look.fog ?? false} className={btnClass(look.fog ?? false)} onClick={() => onLook({ fog: !look.fog })}>Fog</button>
                )}
                {!editing && look.fog && <button type="button" className={`${controls.tool} ${styles.btn}`} onClick={onResetFog}>Cover the map again</button>}
            </div>
        </section>
    );
}

function SceneBoardSection({ mode, look, onLook, onClearMap, showLookControls, boardSize }: { mode: 'session' | 'editor'; look: SceneLook; onLook: (change: Partial<SceneLook>) => void; onClearMap: () => void; showLookControls: boolean; boardSize?: ReactNode }) {
    const editing = mode === 'editor';
    const [sure, setSure] = useState(false);
    const [url, setUrl] = useState(look.map?.url ?? '');
    const [size, setSize] = useState(look.map?.size ?? 30);
    return (
        <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Board</h3>
            {showLookControls && (
                <div className={styles.btnRow} role="group" aria-label="Board style">
                    {BOARD_STYLES.map((s) => (
                        <button aria-pressed={styleOf(look) === s} onClick={() => onLook({ style: s })} key={s} type="button" className={btnClass(styleOf(look) === s)}>{titled(s)}</button>
                    ))}
                </div>
            )}
            {boardSize}
            {showLookControls && editing && (
                sure ? (
                    <div className={styles.btnRow}>
                        <button type="button" className={`${controls.tool} ${styles.btn} ${styles.toolDanger}`} onClick={() => { setSure(false); onClearMap(); }}>Yes, clear everything</button>
                        <button type="button" className={`${controls.tool} ${styles.btn}`} onClick={() => setSure(false)}>Keep it</button>
                    </div>
                ) : (
                    <div className={styles.btnRow}>
                        <button type="button" className={`${controls.tool} ${styles.btn}`} onClick={() => setSure(true)}>Clear map</button>
                    </div>
                )
            )}
            {showLookControls && editing && (
                <form className={styles.mapForm} onSubmit={(e) => { e.preventDefault(); onLook({ map: { url: url.trim(), size } }); }}>
                    <input className={controls.input} type="url" placeholder="Map picture link (https://…)" aria-label="Map picture link"
                        value={url} onChange={(e) => setUrl(e.target.value)} />
                    <label className={controls.field}>Width{' '}
                        <input className={styles.inputRange} type="range" min={10} max={80} step={1} value={size} onChange={(e) => setSize(Number(e.target.value))} />
                    </label>
                    <button type="submit" className={styles.send} disabled={!url.trim()} aria-label="Show map">→</button>
                    {look.map && <button type="button" className={`${controls.tool} ${styles.btn}`} onClick={() => { setUrl(''); onLook({ map: null }); }}>Remove map</button>}
                </form>
            )}
        </section>
    );
}
