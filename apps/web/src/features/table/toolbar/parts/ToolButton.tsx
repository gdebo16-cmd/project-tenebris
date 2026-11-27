import { type Tool } from '../../hooks/tableTypes.ts'
import { ToggleButton } from './ToggleButton.tsx'

export { btnClass } from './ToggleButton.tsx'

export function isPressed(tool: Tool, t: Tool) {
    return tool.type === t.type && (t.type !== 'paint' || (tool.type === 'paint' && tool.terrain === t.terrain));
}

export function ToolButton({ label, t, tool, setTool }: { label: string; t: Tool; tool: Tool; setTool: (t: Tool) => void }) {
    const on = isPressed(tool, t);
    return (
        <ToggleButton pressed={on} onClick={() => setTool(t)}>{label}</ToggleButton>
    );
}
