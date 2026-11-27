import { type Tool } from '../../../../features/table/hooks/tableTypes.ts'
import { type AreaKind } from '@tenebris/rules/sight'
import { ShapeControls } from '../ShapePanels.tsx'
import { ToolButton } from './ToolButton.tsx'
import { ButtonRow } from './ButtonRow.tsx'

export function ShapesRow({ tool, setTool, isDm, editing }: {
    tool: Tool;
    setTool: (t: Tool) => void;
    isDm: boolean;
    editing: boolean;
}) {
    const showShapes = !isDm || !editing;
    if (!showShapes) return null;
    const shapeTool = tool.type === 'shape' ? tool : { type: 'shape' as const, kind: 'circle' as AreaKind, sizeFt: 10, turns: 0, name: '' };
    return (
        <>
            <ButtonRow>
                <ToolButton label="Shapes" t={shapeTool} tool={tool} setTool={setTool} />
                <ToolButton label="Measure" t={{ type: 'measure' }} tool={tool} setTool={setTool} />
            </ButtonRow>
            {tool.type === 'shape' && <ShapeControls tool={tool} setTool={setTool} />}
        </>
    );
}
