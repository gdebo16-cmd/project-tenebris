// The layout editor's bar (above the grid while arranging): save / cancel / reset, the action panel's tabs,
// and the hidden blocks. Moving and resizing happen on the grid itself (SheetLayout.tsx).
import { LAYOUT_DEVICES, PANEL_TABS, addBlock, addToStack, panelTabsOf, setPanelTabs, type LayoutDevice, type PanelTab, type SheetKind, type SheetLayout } from '@tenebris/rules/layout';
import shared from './Sheet.module.css';
import css from './SheetLayout.module.css';
import { PHONE_TABS, blockDef, type BlockId, type PhoneTab } from './blocks/registry.tsx';

type Result = { error: string } | { layout: SheetLayout };
const TAB_LABELS: Record<PanelTab, string> = { actions: 'Actions', spells: 'Spells', gear: 'Gear', features: 'Features' };
const DEVICE_LABELS: Record<LayoutDevice, string> = { desktop: 'Desktop', mobile: 'Mobile' };

type Props = {
    layout: SheetLayout;               // the layout of the device being arranged
    device: LayoutDevice;              // desktop (the grid) or mobile (a stack): each is saved on its own
    canDesktop: boolean;               // the grid can only be arranged on a wide screen
    kind: SheetKind;
    onDevice: (device: LayoutDevice) => void;
    blocks: BlockId[];                 // every block this sheet can use
    onChange: (result: Result) => void;
    onSave: () => void;
    onCancel: () => void;
    onReset: () => void;
    saving: boolean;
    message: string;
};

export function LayoutEditor({ layout, device, canDesktop, kind, onDevice, blocks, onChange, onSave, onCancel, onReset, saving, message }: Props) {
    const shown = new Set(layout.items.map((i) => i.block));
    const hidden = blocks.filter((b) => !shown.has(b));
    const tabs = panelTabsOf(layout);
    const toggleTab = (tab: PanelTab) =>
        onChange(setPanelTabs(layout, tabs.includes(tab) ? tabs.filter((t) => t !== tab) : PANEL_TABS.filter((t) => t === tab || tabs.includes(t)), blocks, device, kind));

    return (
        <section className={css.editor} aria-label="Edit layout">
            <div className={css.editorRow}>
                <span className={css.editorTitle}>Arrange the sheet</span>
                <span className={css.deviceTabs} role="group" aria-label="Layout to arrange">
                    {LAYOUT_DEVICES.filter((d) => d === device || d === 'mobile' || canDesktop).map((d) => (
                        <button key={d} type="button" className={d === device ? css.deviceTabActive : css.deviceTab}
                            aria-pressed={d === device} disabled={saving} onClick={() => onDevice(d)}>{DEVICE_LABELS[d]}</button>
                    ))}
                </span>
                <span className={shared.muted}>
                    {device === 'desktop'
                        ? 'Drag a block to move it, drag its corner to resize it. The Tab menu moves it to a phone tab (or Always shown). Keyboard: arrows move, Shift + arrows resize, Delete hides.'
                        : 'The phone layout, separate from the desktop one. ▲ ▼ move a block, − + change its height, the Tab menu moves it to a tab (or Always shown), × hides it.'}
                </span>
                <span className={css.editorButtons}>
                    <button type="button" className={`${shared.button} ${shared.primary}`} disabled={saving} onClick={onSave}>{saving ? 'Saving…' : 'Save'}</button>
                    <button type="button" className={shared.button} disabled={saving} onClick={onCancel}>Cancel</button>
                    <button type="button" className={shared.button} disabled={saving} onClick={onReset}>{device === 'desktop' ? 'Reset to default' : 'Match desktop'}</button>
                </span>
            </div>
            <div className={css.editorRow}>
                {shown.has('actionPanel') && (
                    <>
                        <span className={css.editorLabel}>Panel tabs</span>
                        {PANEL_TABS.map((tab) => (
                            <label key={tab} className={css.check}>
                                <input type="checkbox" checked={tabs.includes(tab)} disabled={tabs.length === 1 && tabs.includes(tab)}
                                    onChange={() => toggleTab(tab)} />
                                {TAB_LABELS[tab]}
                            </label>
                        ))}
                    </>
                )}
                <span className={css.editorLabel}>Hidden</span>
                {hidden.length === 0 && <span className={shared.muted}>none</span>}
                {hidden.map((b) => (
                    <button key={b} type="button" className={css.addButton} onClick={() => onChange(device === 'desktop' ? addBlock(layout, b) : addToStack(layout, b))}>
                        + {blockDef(b).label}
                    </button>
                ))}
            </div>
            {message && <p className={shared.error} role="alert">{message}</p>}
        </section>
    );
}

const MAIN_TAB = '';   // the <select> value for the main area (always shown, not behind a tab)

// The tab this block sits in: the layout's assignment if it has one, otherwise the block's default
export function tabOf(item: { tab?: string | null }, def: { phoneTab: PhoneTab | null }, kind: SheetKind): PhoneTab | null {
    if ('tab' in item) {
        if (item.tab === null) return null;
        if (PHONE_TABS[kind].some((t) => t.id === item.tab)) return item.tab as PhoneTab;
    }
    return def.phoneTab;
}

// A small menu on a block in the layout editor: move it to any tab, or to Always shown
export function TabPicker({ kind, value, label, onChange }: {
    kind: SheetKind;
    value: PhoneTab | null;
    label: string;
    onChange: (tab: PhoneTab | null) => void;
}) {
    return (
        <label className={css.tabPick} onPointerDown={(e) => e.stopPropagation()}>
            <span className={css.tabPickLabel}>Tab</span>
            <select className={css.tabSelect} aria-label={`Move ${label} to a tab`} value={value ?? MAIN_TAB}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => onChange(e.target.value === MAIN_TAB ? null : e.target.value as PhoneTab)}>
                <option value={MAIN_TAB}>Always shown</option>
                {PHONE_TABS[kind].map((t) => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                ))}
            </select>
        </label>
    );
}