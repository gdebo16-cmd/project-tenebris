import { type Tool } from '../../../../features/table/hooks/tableTypes.ts'
import { ToggleButton } from './ToggleButton.tsx'
import styles from '../../../../styles/components/table/toolbar/Toolbar.module.css'

export { btnClass } from './ToggleButton.tsx'

export function isPressed(tool: Tool, t: Tool) {
    return tool.type === t.type && (t.type !== 'paint' || (tool.type === 'paint' && tool.terrain === t.terrain));
}

export function ToolButton({ className, label, t, tool, setTool }: { className: string; label: string; t: Tool; tool: Tool; setTool: (t: Tool) => void }) {
    const on = isPressed(tool, t);
    return (
        <ul className={styles.toolButtonList}>
            <li className={styles.toolButton}>
                <ToggleButton pressed={on} onClick={() => setTool(t)}>{label}</ToggleButton>
            </li>
        </ul>
    );
}
