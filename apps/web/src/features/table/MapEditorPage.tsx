// The Map Editor (DM): /campaign/:campId/maps lists the campaign's boards; /campaign/:campId/maps/:sceneId edits one.
// Editing a board that isn't on the table changes nothing for the players until the DM puts it on the table.
import { useParams } from 'react-router'
import TablePage from './TablePage.tsx'
import { BoardLibrary } from './BoardLibrary.tsx'

export default function MapEditorPage() {
    const { campId = '', sceneId } = useParams();
    const id = sceneId ? Number(sceneId) : null;
    if (!id) return <BoardLibrary campId={campId} currentId={null} />;
    return (
        <>
            {/* key: a different board starts a fresh editor (tools, camera) */}
            <TablePage key={id} mode="editor" editSceneId={id} />
            <BoardLibrary campId={campId} currentId={id} compact />
        </>
    );
}
