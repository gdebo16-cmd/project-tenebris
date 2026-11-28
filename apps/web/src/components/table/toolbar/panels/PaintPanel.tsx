import { SURFACES, LIBRARY_PAINTS } from '@tenebris/rules/board'
import { surfaceLook } from '../../board/ground/TableScenery.tsx'
import { type PanelProps } from '../../../../features/table/hooks/toolbarTypes.ts'
import { ToggleButton } from '../parts/ToggleButton.tsx'
import { ButtonRow } from '../parts/ButtonRow.tsx'
import { Section } from '../parts/Section.tsx'
import { BrushRow, titled } from '../parts/ToolParts.tsx'
import styles from '../../../../styles/components/table/toolbar/Toolbar.module.css'

function paintCategories() {
    const groups = new Map<string, typeof LIBRARY_PAINTS[number][]>();
    for (const paint of LIBRARY_PAINTS) {
        const list = groups.get(paint.category) ?? [];
        list.push(paint);
        groups.set(paint.category, list);
    }
    return [...groups.entries()];
}

export function PaintPanel({ tool, setTool, brush, setBrush }: PanelProps) {
    return (
        <Section className={styles.paintSection} id="board-tab-panel-paint" labelledBy="board-tab-paint">
            <h2 className={styles.panelTitle}>Tile Paint</h2>
            {tool.type === 'surface' && (
                <BrushRow brush={brush} setBrush={setBrush} />
            )}
            <ToggleButton className={styles.objectButton} pressed={tool.type === 'surface' && tool.surface === null} onClick={() => setTool({ type: 'surface', surface: null })}>Clear</ToggleButton>
            <div className={styles.paintList}>
                {paintCategories().map(([category, paints]) => (
                    <div className={styles.paintCategory} key={category}>
                        <h3 className={styles.surfaceTitle}>{titled(category)}</h3>
                        <ButtonRow className={styles.surfaceButtonRow}>
                            {paints.map((p) => (
                                <ToggleButton className={styles.surfaceButton} key={p.id} pressed={tool.type === 'surface' && tool.surface === p.id} onClick={() => setTool({ type: 'surface', surface: p.id })}>
                                    <span className={styles.swatchThumb} style={{ backgroundImage: 'url(' + p.thumb + ')' }} aria-hidden="true" />
                                    {p.name}
                                </ToggleButton>
                            ))}
                        </ButtonRow>
                    </div>
                ))}
                <h3 className={styles.surfaceTitle}>Core</h3>
                <ButtonRow className={styles.surfaceButtonRow}>
                    {SURFACES.map((s) => (
                        <ToggleButton className={styles.surfaceButton} key={s} pressed={tool.type === 'surface' && tool.surface === s} onClick={() => setTool({ type: 'surface', surface: s })}>
                            <span className={styles.swatch} data-surface={s} aria-hidden="true" />
                            {surfaceLook(s).label}
                        </ToggleButton>
                    ))}
                </ButtonRow>
            </div>
        </Section>
    );
}
