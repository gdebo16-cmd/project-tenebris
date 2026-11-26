import { debugDraw } from './tableDebug.ts'
import { useTableController } from './useTableController.ts'
import { messageOf } from './tableUtils.ts'
import { TablePanels } from './TablePanels.tsx'
import { BoardCanvas } from './BoardCanvas.tsx'
import styles from './TablePage.module.css'

// The table (Stage 2, steps 11–13): the map, a hex grid over it, painted terrain and tokens, drawn with R3F from a
// camera looking straight down. Everything that changes goes to the server, which decides (sceneController.js):
// the board only asks and shows the answer.
//
// This file is the thin shell. The pieces: useTableController.ts (state + clicks), TablePanels.tsx (tools, feed, turn bar),
// BoardCanvas.tsx (the 3D board), Toolbar.tsx, TokenOnBoard.tsx, HoverLayer.tsx, ActPanel.tsx, ShapePanels.tsx, Feed.tsx.
//
// mode: 'session' = Play Session (tokens, moving, acting, shapes, measuring, fog, the turn bar, the board selector);
//       'editor'  = Map Editor for one board (painting, erasing, features, heights, the board's look; no combat).
export default function TablePage({ mode = 'session', editSceneId = null }: { mode?: 'session' | 'editor'; editSceneId?: number | null }) {
    debugDraw('TablePage');
    const c = useTableController(mode, editSceneId);
    if (c.error) return <p className={styles.notice} role="alert">{messageOf(c.error)}</p>;
    if (c.data && !c.data.scene) return <p className={styles.notice}>The DM hasn't opened the table yet.</p>;
    return (
        <div className={styles.board} ref={c.boardRef}>
            <TablePanels c={c} />
            <BoardCanvas c={c} />
        </div>
    );
}
