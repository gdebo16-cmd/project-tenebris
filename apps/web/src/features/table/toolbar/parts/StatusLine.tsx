import { type Token } from '../../hooks/tableQueries.ts'
import { type Tool, PAINT_TOOLS } from '../../hooks/tableTypes.ts'
import styles from '../Toolbar.module.css'
import controls from '../TableControls.module.css'

export function StatusLine({ message, selectedToken, tool, editing, isDm }: {
    message: string;
    selectedToken: Token | null;
    tool: Tool;
    editing: boolean;
    isDm: boolean;
}) {
    const status = message
        || (selectedToken ? `${selectedToken.name}: click a hex to move there` : '')
        || (tool.type === 'scene' ? (editing ? "This board's look when it's put on the table" : 'Change the mood for everyone at the table') : '')
        || (tool.type === 'measure' ? 'Drag from one hex to another to measure' : '')
        || (isDm && PAINT_TOOLS.includes(tool.type) ? 'Click or drag to paint · right-drag turns the camera' : '')
        || (tool.type === 'move' ? 'Click your token, then a hex' : tool.type === 'place' ? 'Click a hex to place it' : tool.type === 'surface' ? 'Click hexes to change the ground' : tool.type === 'feature' ? (tool.kind ? 'Click a hex to place it' : 'Click a feature to remove it') : 'Click hexes to paint');
    return (
        <p className={message ? `${controls.status} ${styles.error}` : controls.status} role={message ? 'alert' : 'status'}>{status}</p>
    );
}
