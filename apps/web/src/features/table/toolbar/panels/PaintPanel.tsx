import { SURFACES, LIBRARY_PAINTS } from '@tenebris/rules/board'
import { surfaceLook } from '../../board/ground/TableScenery.tsx'
import { type PanelProps } from '../toolbarTypes.ts'
import { ToggleButton } from '../parts/ToggleButton.tsx'
import { ButtonRow } from '../parts/ButtonRow.tsx'
import { Section } from '../parts/Section.tsx'
import { BrushRow, titled } from '../parts/ToolParts.tsx'
import styles from '../Toolbar.module.css'

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
        <Section id="board-tab-panel-paint" labelledBy="board-tab-paint">
            {tool.type === 'surface' && (
                <BrushRow brush={brush} setBrush={setBrush} />
            )}
            <div className={styles.paintList}>
                <h3 className={styles.sectionTitle}>Core</h3>
                <ButtonRow>
                    {SURFACES.map((s) => (
                        <ToggleButton key={s} pressed={tool.type === 'surface' && tool.surface === s} onClick={() => setTool({ type: 'surface', surface: s })}>
                            <span className={styles.swatch} data-surface={s} aria-hidden="true" />
                            {surfaceLook(s).label}
                        </ToggleButton>
                    ))}
                    <ToggleButton pressed={tool.type === 'surface' && tool.surface === null} onClick={() => setTool({ type: 'surface', surface: null })}>Clear</ToggleButton>
                </ButtonRow>
                {paintCategories().map(([category, paints]) => (
                    <div key={category}>
                        <h3 className={styles.sectionTitle}>{titled(category)}</h3>
                        <ButtonRow>
                            {paints.map((p) => (
                                <ToggleButton key={p.id} pressed={tool.type === 'surface' && tool.surface === p.id} onClick={() => setTool({ type: 'surface', surface: p.id })}>
                                    <span className={styles.swatchThumb} style={{ backgroundImage: 'url(' + p.thumb + ')' }} aria-hidden="true" />
                                    {p.name}
                                </ToggleButton>
                            ))}
                        </ButtonRow>
                    </div>
                ))}
            </div>
        </Section>
    );
}
