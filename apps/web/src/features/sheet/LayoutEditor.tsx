// The layout editor's bar (above the grid while arranging): save / cancel / reset, the action panel's tabs,
// and the hidden blocks. Moving and resizing happen on the grid itself (SheetLayout.tsx).
import { PANEL_TABS, addBlock, panelTabsOf, setPanelTabs, type PanelTab, type SheetLayout } from '@tenebris/rules/layout';
import shared from './Sheet.module.css';
import css from './SheetLayout.module.css';
import { blockDef, type BlockId } from './blocks/registry.tsx';

type Result = { error: string } | { layout: SheetLayout };
const TAB_LABELS: Record<PanelTab, string> = { actions: 'Actions', spells: 'Spells', gear: 'Gear', features: 'Features' };

type Props = {
    layout: SheetLayout;
    blocks: BlockId[];                 // every block this sheet can use
    onChange: (result: Result) => void;
    onSave: () => void;
    onCancel: () => void;
    onReset: () => void;
    saving: boolean;
    message: string;
};

export function LayoutEditor({ layout, blocks, onChange, onSave, onCancel, onReset, saving, message }: Props) {
    const shown = new Set(layout.items.map((i) => i.block));
    const hidden = blocks.filter((b) => !shown.has(b));
    const tabs = panelTabsOf(layout);
    const toggleTab = (tab: PanelTab) =>
        onChange(setPanelTabs(layout, tabs.includes(tab) ? tabs.filter((t) => t !== tab) : PANEL_TABS.filter((t) => t === tab || tabs.includes(t)), blocks));

    return (
        <section className={css.editor} aria-label="Edit layout">
            <div className={css.editorRow}>
                <span className={css.editorTitle}>Arrange the sheet</span>
                <span className={shared.muted}>Drag a block to move it, drag its corner to resize it. Keyboard: arrows move, Shift + arrows resize, Delete hides.</span>
                <span className={css.editorButtons}>
                    <button type="button" className={`${shared.button} ${shared.primary}`} disabled={saving} onClick={onSave}>{saving ? 'Saving…' : 'Save'}</button>
                    <button type="button" className={shared.button} disabled={saving} onClick={onCancel}>Cancel</button>
                    <button type="button" className={shared.button} disabled={saving} onClick={onReset}>Reset to default</button>
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
                    <button key={b} type="button" className={css.addButton} onClick={() => onChange(addBlock(layout, b))}>
                        + {blockDef(b).label}
                    </button>
                ))}
            </div>
            {message && <p className={shared.error} role="alert">{message}</p>}
        </section>
    );
}
