// The Map Editor (DM): /campaign/:campId/maps lists the campaign's boards; /campaign/:campId/maps/:sceneId edits one.
// Editing a board that isn't on the table changes nothing for the players until the DM puts it on the table.
import { useParams } from 'react-router'
import { radiusOf } from '@tenebris/rules/board'
import TablePage from './TablePage.tsx'
import { BoardLibrary } from './BoardLibrary.tsx'
import { BoardSize } from './BoardSize.tsx'
import { useScene, useSetLook } from './tableQueries.ts'
import { messageOf } from './tableUtils.ts'

// The size picker for the board being edited: reads and saves the board's radius (look.radius)
function EditorBoardSize({ campId, sceneId }: { campId: string; sceneId: number }) {
    const board = `${campId}@${sceneId}`;
    const { data } = useScene(board);
    const setLook = useSetLook(board);
    if (!data?.scene) return null;
    return (
        <BoardSize value={radiusOf(data.scene.look)} error={setLook.error ? messageOf(setLook.error) : undefined}
            onChange={(radius) => setLook.mutate({ sceneId, radius })} />
    );
}

export default function MapEditorPage() {
    const { campId = '', sceneId } = useParams();
    const id = sceneId ? Number(sceneId) : null;
    if (!id) return <BoardLibrary campId={campId} currentId={null} />;
    return (
        <>
            {/* key: a different board starts a fresh editor (tools, camera) */}
            <TablePage key={id} mode="editor" editSceneId={id} />
            <EditorBoardSize campId={campId} sceneId={id} />
            <BoardLibrary campId={campId} currentId={id} compact />
        </>
    );
}
