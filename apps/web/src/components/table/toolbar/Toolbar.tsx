import { type ComponentType, useState } from 'react'
import { type Tool } from '../../../features/table/hooks/tableTypes.ts'
import { TERRAIN_KINDS } from '@tenebris/rules/board'
import styles from './Toolbar.module.css'
import { isPressed } from './parts/ToolButton.tsx'
import { type ToolbarProps, type PanelProps } from '../../../features/table/hooks/toolbarTypes.ts'
import { ShapesRow } from './parts/ShapesRow.tsx'
import { StatusLine } from './parts/StatusLine.tsx'
import { EffectsPanel } from './panels/EffectsPanel.tsx'
import { PaintPanel } from './panels/PaintPanel.tsx'
import { ObjectsPanel } from './panels/ObjectsPanel.tsx'
import { ScenePanel } from './panels/ScenePanel.tsx'
import { RemovePanel } from './panels/RemovePanel.tsx'

const effectsIcon = '/icons/toolbar/Effects.svg'
const paintIcon = '/icons/toolbar/Paint.svg'
const objectsIcon = '/icons/toolbar/Objects.svg'
const sceneIcon = '/icons/toolbar/Scene.svg'
const removeIcon = '/icons/toolbar/Remove.svg'
const moveIcon = '/icons/toolbar/Move.svg'
const sidebarOpenIcon = '/icons/toolbar/SidebarOpen.svg'
const sidebarCloseIcon = '/icons/toolbar/SidebarClose.svg'

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

const TAB_ICON: Record<ToolTab, string> = {
    effects: effectsIcon,
    paint: paintIcon,
    objects: objectsIcon,
    scene: sceneIcon,
    remove: removeIcon,

};

const PANELS: Record<ToolTab, ComponentType<PanelProps>> = {
    effects: EffectsPanel,
    paint: PaintPanel,
    objects: ObjectsPanel,
    scene: ScenePanel,
    remove: RemovePanel,
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

function editorOnly(tab: ToolTab) {
    return tab === 'effects' || tab === 'paint';
}

// The tools above the board. Players see only their status line; the DM gets brushes, Place and Remove.
export function Toolbar(props: ToolbarProps) {
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

    const openTo = (next: ToolTab) => {
        selectTab(next);
        if (!open) toggleOpen();
    };

    const pressed = (t: Tool) => isPressed(tool, t);
    const Panel = isDm && (!editorOnly(currentTab) || editing) ? PANELS[currentTab] : null;

    return (
        <div className={`${styles.toolbar} ${open ? styles.toolbarOpen : styles.toolbarClosed}`} aria-label="Table tools">
            <div className={styles.header}>
                <div className={styles.headerTools}>
                    
                <button type="button" className={styles.collapse} aria-expanded={open} aria-controls="board-tools-body"
                        aria-label={open ? 'Close tools' : 'Open tools'} title={open ? 'Close tools' : 'Open tools'}
                        onClick={toggleOpen}>
                        <img src={open ? sidebarCloseIcon : sidebarOpenIcon} alt="" className={styles.tabIcon} />
                    </button>
                    <button type="button" className={pressed({ type: 'move' }) ? `${styles.headerTab} ${styles.tabOn}` : styles.headerTab}
                        aria-pressed={pressed({ type: 'move' })} aria-label="Move" title="Move"
                        onClick={() => setTool({ type: 'move' })}>
                        <img src={moveIcon} alt="" className={styles.tabIcon} />
                    </button>
                    {allowedTabs.map((id) => (
                        <button key={id} type="button" role="tab" aria-selected={open && currentTab === id}
                            aria-label={TAB_LABEL[id]} title={TAB_LABEL[id]}
                            className={open && currentTab === id ? `${styles.headerTab} ${styles.tabOn}` : styles.headerTab}
                            onClick={() => openTo(id)}>
                            <img src={TAB_ICON[id]} alt="" className={styles.tabIcon} />
                        </button>
                    ))}
                </div>
            </div>
            {open && (
                <div id="board-tools-body" className={styles.body}>
                    <ShapesRow tool={tool} setTool={setTool} isDm={isDm} editing={editing} />
                    {Panel && <Panel {...props} editing={editing} />}
                    {props.children}
                    <StatusLine message={message} selectedToken={selectedToken} tool={tool} editing={editing} isDm={isDm} />
                </div>
            )}
        </div>
    );
}
