import { TERRAIN_KINDS, MAX_HEIGHT } from '@tenebris/rules/board'
import { type PanelProps } from '../toolbarTypes.ts'
import { ToolButton } from '../parts/ToolButton.tsx'
import { ToggleButton } from '../parts/ToggleButton.tsx'
import { ButtonRow } from '../parts/ButtonRow.tsx'
import { Section } from '../parts/Section.tsx'
import { BrushRow, titled } from '../parts/ToolParts.tsx'

export function EffectsPanel({ tool, setTool, brush, setBrush }: PanelProps) {
    return (
        <Section id="board-tab-panel-effects" labelledBy="board-tab-effects">
            <ButtonRow>
                {TERRAIN_KINDS.map((kind) => <span key={kind}><ToolButton label={titled(kind)} t={{ type: 'paint', terrain: kind }} tool={tool} setTool={setTool} /></span>)}
                <ToolButton label="Height" t={tool.type === 'height' ? tool : { type: 'height', height: 1 }} tool={tool} setTool={setTool} />
            </ButtonRow>
            {tool.type === 'height' && (
                <ButtonRow>
                    {Array.from({ length: MAX_HEIGHT + 1 }, (_, h) => (
                        <ToggleButton key={h} pressed={tool.height === h} onClick={() => setTool({ type: 'height', height: h })}>{h === 0 ? 'Flat' : `Up ${h}`}</ToggleButton>
                    ))}
                </ButtonRow>
            )}
            {(tool.type === 'paint' || tool.type === 'height') && (
                <BrushRow brush={brush} setBrush={setBrush} />
            )}
        </Section>
    );
}
