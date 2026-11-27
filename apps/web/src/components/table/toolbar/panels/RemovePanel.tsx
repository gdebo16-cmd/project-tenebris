import { type PanelProps } from '../../../../features/table/hooks/toolbarTypes.ts'
import { ToolButton } from '../parts/ToolButton.tsx'
import { BrushRow, ClearMapRow } from '../parts/ToolParts.tsx'
import { ButtonRow } from '../parts/ButtonRow.tsx'
import { Section } from '../parts/Section.tsx'
import { ActionButton } from '../parts/ActionButton.tsx'
import styles from '../../../../styles/components/table/toolbar/Toolbar.module.css'

export function RemovePanel({ editing, tool, setTool, brush, setBrush, onClearMap, selectedToken, onRemove }: PanelProps) {
    return (
        <Section id="board-tab-panel-remove">
            {editing && (
                <>
                    <ButtonRow>
                        <ToolButton label="Eraser" t={{ type: 'erase' }} tool={tool} setTool={setTool} />
                    </ButtonRow>
                    {tool.type === 'erase' && <BrushRow brush={brush} setBrush={setBrush} />}
                    <ClearMapRow onClearMap={onClearMap} />
                </>
            )}
            {selectedToken ? (
                <ButtonRow>
                    <ActionButton onClick={onRemove}>Remove {selectedToken.name}</ActionButton>
                </ButtonRow>
            ) : (
                !editing && <p className={styles.hint}>Click a token on the board, then remove it here.</p>
            )}
        </Section>
    );
}
