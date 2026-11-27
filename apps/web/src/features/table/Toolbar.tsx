import { type SceneData, type Token, type Brush } from './tableQueries.ts'
import { type Tool, PAINT_TOOLS, BRUSHES } from './tableTypes.ts'
import { type SceneLook, TERRAIN_KINDS, MAX_HEIGHT, SURFACES, SHAPE_FEATURE_KINDS, SCENE_MOODS, SCENE_WEATHERS, BOARD_STYLES, styleOf, GRID_MODES, gridOf, LIBRARY_PAINTS, BOARD_MODELS } from '@tenebris/rules/board'
import { type ReactNode, useState } from 'react'
import { type AreaKind } from '@tenebris/rules/sight'
import { ShapeControls } from './ShapePanels.tsx'
import { surfaceLook } from './TableScenery.tsx'
import { FEATURE_LOOK } from './BoardFeatures.tsx'
import { Room } from './BoardWorld.tsx'
import { Fog } from './BoardActs.tsx'
import styles from './Toolbar.module.css'
import controls from './TableControls.module.css'

const TOOLS_OPEN_KEY = 'tenebris-board-tools'
const TOOLS_TAB_KEY = 'tenebris-board-tools-tab'
const TOOL_TABS = ['effects', 'paint', 'objects', 'scene', 'remove'] as const;
type ToolTab = (typeof TOOL_TABS)[number];
const TAB_LABEL: Record<ToolTab, string> = {
    effects: 'Hex effects',
    paint: 'Hex paint',
    objects: 'Objects',
    scene: 'Scene',
    remove: 'Remove',
};

function toolsAreOpen() {
    try { return sessionStorage.getItem(TOOLS_OPEN_KEY) !== 'closed' } catch { return true }
}

function tabsFor(isDm: boolean, mode: 'session' | 'editor'): ToolTab[] {
    if (!isDm) return [];
    if (mode === 'editor') return ['effects', 'paint', 'objects', 'scene', 'remove'];
    return ['objects', 'scene', 'remove'];
}

function tabFromStorage(allowed: ToolTab[]): ToolTab {
    const fallback = allowed[0] ?? 'scene';
    if (allowed.length === 0) return fallback;
    try {
        const saved = sessionStorage.getItem(TOOLS_TAB_KEY);
        if (saved && allowed.some((tab) => tab === saved)) return saved as ToolTab;
    } catch { /* private mode */ }
    return fallback;
}

function rememberTab(tab: ToolTab) {
    try { sessionStorage.setItem(TOOLS_TAB_KEY, tab) } catch { /* private mode */ }
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
    const editing = props.mode === 'editor';
    const allowedTabs = tabsFor(isDm, props.mode);
    const [open, setOpen] = useState(toolsAreOpen);
    const [tab, setTab] = useState<ToolTab>(() => tabFromStorage([...TOOL_TABS]));
    const currentTab = allowedTabs.includes(tab) ? tab : tabFromStorage(allowedTabs);
    const toggleOpen = () => setOpen((was) => {
        const next = !was;
        try { sessionStorage.setItem(TOOLS_OPEN_KEY, next ? 'open' : 'closed') } catch { /* private mode */ }
        return next;
    });
    const selectTab = (next: ToolTab) => {
        setTab(next);
        rememberTab(next);
        if (next === 'scene' && tool.type !== 'scene') setTool({ type: 'scene' });
        if (next === 'effects' && tool.type !== 'paint' && tool.type !== 'height') setTool({ type: 'paint', terrain: TERRAIN_KINDS[0] ?? null });
        if (next === 'paint' && tool.type !== 'surface') setTool({ type: 'surface', surface: 'cobble' });
    };
    const pressed = (t: Tool) => tool.type === t.type && (t.type !== 'paint' || (tool.type === 'paint' && tool.terrain === t.terrain));
    const button = (label: string, t: Tool) => (
        <button type="button" className={btnClass(pressed(t))}
            aria-pressed={pressed(t)} onClick={() => setTool(t)}>{label}</button>
    );

    const status = message
        || (selectedToken ? `${selectedToken.name}: click a hex to move there` : '')
        || (tool.type === 'scene' ? (editing ? "This board's look when it's put on the table" : 'Change the mood for everyone at the table') : '')
        || (tool.type === 'measure' ? 'Drag from one hex to another to measure' : '')
        || (isDm && PAINT_TOOLS.includes(tool.type) ? 'Click or drag to paint · right-drag turns the camera' : '')
        || (tool.type === 'move' ? 'Click your token, then a hex' : tool.type === 'place' ? 'Click a hex to place it' : tool.type === 'surface' ? 'Click hexes to change the ground' : tool.type === 'feature' ? (tool.kind ? 'Click a hex to place it' : 'Click a feature to remove it') : 'Click hexes to paint');

    const shapeTool = tool.type === 'shape' ? tool : { type: 'shape' as const, kind: 'circle' as AreaKind, sizeFt: 10, turns: 0, name: '' };
    const showShapes = !isDm || !editing;

    return (
        <div className={`${styles.toolbar} ${open ? styles.toolbarOpen : styles.toolbarClosed}`} aria-label="Table tools">
            <div className={styles.header}>
                <h2 className={styles.title}>Board tools</h2>
                <div className={styles.headerTools}>
                    {button('Move', { type: 'move' })}
                    <button type="button" className={styles.collapse} aria-expanded={open} aria-controls="board-tools-body"
                        onClick={toggleOpen}>{open ? '▾' : '▸'}</button>
                </div>
            </div>
            {open && (
                <div id="board-tools-body" className={styles.body}>
                    {showShapes && (
                        <div className={styles.btnRow}>
                            {button('Shapes', shapeTool)}
                            {button('Measure', { type: 'measure' })}
                        </div>
                    )}
                    {allowedTabs.length > 0 && (
                        <div className={styles.tabs} role="tablist" aria-label="Board tool categories">
                            {allowedTabs.map((id) => (
                                <button key={id} type="button" role="tab" id={`board-tab-${id}`}
                                    aria-selected={currentTab === id} aria-controls={`board-tab-panel-${id}`}
                                    className={currentTab === id ? `${styles.tab} ${styles.tabOn}` : styles.tab}
                                    onClick={() => selectTab(id)}>{TAB_LABEL[id]}</button>
                            ))}
                        </div>
                    )}
                    {tool.type === 'shape' && <ShapeControls tool={tool} setTool={setTool} />}
                    {currentTab === 'effects' && isDm && editing && (
                        <div className={styles.section} role="tabpanel" id="board-tab-panel-effects" aria-labelledby="board-tab-effects">
                            <div className={styles.btnRow}>
                                {TERRAIN_KINDS.map((kind) => <span key={kind}>{button(titled(kind), { type: 'paint', terrain: kind })}</span>)}
                                {button('Height', tool.type === 'height' ? tool : { type: 'height', height: 1 })}
                            </div>
                            {tool.type === 'height' && (
                                <div className={styles.btnRow}>
                                    {Array.from({ length: MAX_HEIGHT + 1 }, (_, h) => (
                                        <button key={h} type="button" aria-pressed={tool.height === h}
                                            className={btnClass(tool.height === h)}
                                            onClick={() => setTool({ type: 'height', height: h })}>{h === 0 ? 'Flat' : `Up ${h}`}</button>
                                    ))}
                                </div>
                            )}
                            {(tool.type === 'paint' || tool.type === 'height') && (
                                <BrushRow brush={props.brush} setBrush={props.setBrush} />
                            )}
                        </div>
                    )}
                    {currentTab === 'paint' && isDm && editing && (
                        <div className={styles.section} role="tabpanel" id="board-tab-panel-paint" aria-labelledby="board-tab-paint">
                            {tool.type === 'surface' && (
                                <BrushRow brush={props.brush} setBrush={props.setBrush} />
                            )}
                            <div className={styles.paintList}>
                                <h3 className={styles.sectionTitle}>Core</h3>
                                <div className={styles.btnRow}>
                                    {SURFACES.map((s) => (
                                        <button key={s} type="button" aria-pressed={tool.type === 'surface' && tool.surface === s}
                                            className={btnClass(tool.type === 'surface' && tool.surface === s)}
                                            onClick={() => setTool({ type: 'surface', surface: s })}>
                                            <span className={styles.swatch} data-surface={s} aria-hidden="true" />
                                            {surfaceLook(s).label}
                                        </button>
                                    ))}
                                    <button type="button" aria-pressed={tool.type === 'surface' && tool.surface === null}
                                        className={btnClass(tool.type === 'surface' && tool.surface === null)}
                                        onClick={() => setTool({ type: 'surface', surface: null })}>Clear</button>
                                </div>
                                {paintCategories().map(([category, paints]) => (
                                    <div key={category}>
                                        <h3 className={styles.sectionTitle}>{titled(category)}</h3>
                                        <div className={styles.btnRow}>
                                            {paints.map((p) => (
                                                <button key={p.id} type="button" aria-pressed={tool.type === 'surface' && tool.surface === p.id}
                                                    className={btnClass(tool.type === 'surface' && tool.surface === p.id)}
                                                    onClick={() => setTool({ type: 'surface', surface: p.id })}>
                                                    <span className={styles.swatchThumb} style={{ backgroundImage: 'url(' + p.thumb + ')' }} aria-hidden="true" />
                                                    {p.name}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {currentTab === 'objects' && isDm && (
                        <div className={styles.section} role="tabpanel" id="board-tab-panel-objects" aria-labelledby="board-tab-objects">
                            {editing && (
                                <>
                                    <h3 className={styles.sectionTitle}>Features</h3>
                                    <div className={styles.btnRow}>
                                        {SHAPE_FEATURE_KINDS.map((k) => (
                                            <button key={k} type="button" aria-pressed={tool.type === 'feature' && tool.kind === k}
                                                className={btnClass(tool.type === 'feature' && tool.kind === k)}
                                                onClick={() => setTool({ type: 'feature', kind: k, size: tool.type === 'feature' ? tool.size : 1, color: tool.type === 'feature' ? tool.color : '#ffd08a' })}>{FEATURE_LOOK[k].label}</button>
                                        ))}
                                        <button type="button" aria-pressed={tool.type === 'feature' && tool.kind === null}
                                            className={btnClass(tool.type === 'feature' && tool.kind === null)}
                                            onClick={() => setTool({ type: 'feature', kind: null, size: tool.type === 'feature' ? tool.size : 1, color: tool.type === 'feature' ? tool.color : '#ffd08a' })}>Remove</button>
                                        {tool.type === 'feature' && (
                                            <label className={controls.field}>Size{' '}
                                                <input className={styles.inputRange} type="range" min={0.5} max={2} step={0.1} value={tool.size}
                                                    onChange={(e) => setTool({ ...tool, size: Number(e.target.value) })} />
                                            </label>
                                        )}
                                        {tool.type === 'feature' && tool.kind === 'light' && (
                                            <label className={controls.field}>Colour{' '}
                                                <input className={styles.inputColor} type="color" value={tool.color} onChange={(e) => setTool({ ...tool, color: e.target.value })} />
                                            </label>
                                        )}
                                    </div>
                                    {tool.type === 'feature' && (
                                        <BrushRow brush={props.brush} setBrush={props.setBrush} />
                                    )}
                                    <LibraryObjects tool={tool} setTool={setTool} />
                                </>
                            )}
                            <h3 className={styles.sectionTitle}>Place</h3>
                            <div className={styles.btnRow}>
                                {button('Place', { type: 'place' })}
                                {tool.type === 'place' && (
                                    <>
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
                                    </>
                                )}
                            </div>
                            {selectedToken && (
                                <div className={styles.btnRow}>
                                    <button type="button" className={`${controls.tool} ${styles.btn}`} onClick={props.onRemove}>Remove {selectedToken.name}</button>
                                </div>
                            )}
                        </div>
                    )}
                    {currentTab === 'scene' && isDm && (
                        <div className={styles.section} role="tabpanel" id="board-tab-panel-scene" aria-labelledby="board-tab-scene">
                            <SceneLookSection mode={props.mode} look={props.look} onLook={props.onLook} onResetFog={props.onResetFog} />
                            <SceneBoardSection mode={props.mode} look={props.look} onLook={props.onLook} boardSize={props.boardSize} />
                        </div>
                    )}
                    {currentTab === 'remove' && isDm && (
                        <div className={styles.section} role="tabpanel" id="board-tab-panel-remove" aria-labelledby="board-tab-remove">
                            {editing && (
                                <>
                                    <div className={styles.btnRow}>
                                        {button('Eraser', { type: 'erase' })}
                                    </div>
                                    {tool.type === 'erase' && (
                                        <BrushRow brush={props.brush} setBrush={props.setBrush} />
                                    )}
                                    <ClearMapRow onClearMap={props.onClearMap} />
                                </>
                            )}
                            {selectedToken ? (
                                <div className={styles.btnRow}>
                                    <button type="button" className={`${controls.tool} ${styles.btn}`} onClick={props.onRemove}>Remove {selectedToken.name}</button>
                                </div>
                            ) : (
                                !editing && <p className={styles.hint}>Click a token on the board, then remove it here.</p>
                            )}
                        </div>
                    )}
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

function BrushRow({ brush, setBrush }: { brush: number; setBrush: (b: number) => void }) {
    return (
        <div className={styles.btnRow}>
            <span className={controls.field}>Brush:</span>
            {BRUSHES.map(([label, rings]) => (
                <button key={rings} type="button" aria-pressed={brush === rings}
                    className={btnClass(brush === rings)}
                    onClick={() => setBrush(rings)}>{label}</button>
            ))}
        </div>
    );
}

function ClearMapRow({ onClearMap }: { onClearMap: () => void }) {
    const [sure, setSure] = useState(false);
    return sure ? (
        <div className={styles.btnRow}>
            <button type="button" className={`${controls.tool} ${styles.btn} ${styles.toolDanger}`} onClick={() => { setSure(false); onClearMap(); }}>Yes, clear everything</button>
            <button type="button" className={`${controls.tool} ${styles.btn}`} onClick={() => setSure(false)}>Keep it</button>
        </div>
    ) : (
        <div className={styles.btnRow}>
            <button type="button" className={`${controls.tool} ${styles.btn}`} onClick={() => setSure(true)}>Clear map</button>
        </div>
    );
}

// Mood, weather, room and fog. Each change goes to the server at once, and every screen at the table follows.
function SceneLookSection({ mode, look, onLook, onResetFog }: { mode: 'session' | 'editor'; look: SceneLook; onLook: (change: Partial<SceneLook>) => void; onResetFog: () => void }) {
    const editing = mode === 'editor';
    return (
        <>
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
        </>
    );
}

function SceneBoardSection({ mode, look, onLook, boardSize }: { mode: 'session' | 'editor'; look: SceneLook; onLook: (change: Partial<SceneLook>) => void; boardSize?: ReactNode }) {
    const editing = mode === 'editor';
    const [url, setUrl] = useState(look.map?.url ?? '');
    const [size, setSize] = useState(look.map?.size ?? 30);
    return (
        <>
            <h3 className={styles.sectionTitle}>Board</h3>
            <div className={styles.btnRow} role="group" aria-label="Board style">
                {BOARD_STYLES.map((s) => (
                    <button aria-pressed={styleOf(look) === s} onClick={() => onLook({ style: s })} key={s} type="button" className={btnClass(styleOf(look) === s)}>{titled(s)}</button>
                ))}
            </div>
            <div className={styles.btnRow} role="group" aria-label="Grid">
                <span className={controls.field}>Grid:</span>
                {GRID_MODES.map((g) => (
                    <button aria-pressed={gridOf(look) === g} onClick={() => onLook({ grid: g })} key={g} type="button" className={btnClass(gridOf(look) === g)}>{titled(g)}</button>
                ))}
            </div>
            {boardSize}
            {editing && (
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
        </>
    );
}


function paintCategories() {
    const groups = new Map<string, typeof LIBRARY_PAINTS[number][]>();
    for (const paint of LIBRARY_PAINTS) {
        const list = groups.get(paint.category) ?? [];
        list.push(paint);
        groups.set(paint.category, list);
    }
    return [...groups.entries()];
}

function LibraryObjects({ tool, setTool }: { tool: Tool; setTool: (t: Tool) => void }) {
    const [query, setQuery] = useState('');
    const needle = query.trim().toLowerCase();
    const groups = new Map<string, typeof BOARD_MODELS[number][]>();
    for (const model of BOARD_MODELS) {
        if (needle && !`${model.name} ${model.category ?? ''}`.toLowerCase().includes(needle)) continue;
        const category = model.category ?? 'props';
        const list = groups.get(category) ?? [];
        list.push(model);
        groups.set(category, list);
    }
    const size = tool.type === 'feature' ? tool.size : 1;
    const color = tool.type === 'feature' ? tool.color : '#ffd08a';
    return (
        <>
            <h3 className={styles.sectionTitle}>Library</h3>
            <div className={styles.btnRow}>
                <input className={controls.input} type="search" value={query} placeholder="Search objects"
                    aria-label="Search objects" onChange={(e) => setQuery(e.target.value)} />
            </div>
            <div className={styles.objectList}>
                {[...groups.entries()].map(([category, models]) => (
                    <div key={category}>
                        <h3 className={styles.sectionTitle}>{titled(category)}</h3>
                        <div className={styles.btnRow}>
                            {models.map((model) => (
                                <button key={model.id} type="button"
                                    aria-pressed={tool.type === 'feature' && tool.kind === 'model' && tool.model === model.id}
                                    className={btnClass(tool.type === 'feature' && tool.kind === 'model' && tool.model === model.id)}
                                    onClick={() => setTool({ type: 'feature', kind: 'model', model: model.id, size, color })}>
                                    {model.name}
                                </button>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </>
    );
}
