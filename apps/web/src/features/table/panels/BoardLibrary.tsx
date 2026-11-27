// The board library (Map Editor) and the board selector (Play Session).
//   BoardLibrary  : the DM's boards: open one to edit it, make new ones (empty or a copy), rename, delete, put one on the table
//   BoardSelector : in the play session, which board is on the table; the DM switches boards from it, players just see the name
//   MeasureLine   : the Measure tool's line and its distance (5 ft per hex)
import { useState, type RefObject } from 'react'
import { Link, useNavigate } from 'react-router'
import { Html } from '@react-three/drei'
import { type Hex, distance } from '@tenebris/rules/board'
import { hexLine } from '@tenebris/rules/sight'
import { ApiError } from '../../../api.ts'
import { useBoards, useCreateBoard, useRenameBoard, useDeleteBoard, useSetLiveBoard, type BoardInfo } from '../hooks/tableQueries.ts'
import { HexPatches } from '../board/overlays/BoardActs.tsx'
import { hexToWorld, liftOf } from '../board/ground/TableScenery.tsx'
import styles from './BoardLibrary.module.css'

const messageOf = (err: unknown) => (err instanceof ApiError ? err.message : 'Something went wrong');

// ---- Play Session: which board is on the table ----

export function BoardSelector({ campId, isDm }: { campId: string; isDm: boolean }) {
    const { data } = useBoards(campId);
    const setLive = useSetLiveBoard(campId);
    const boards = data?.scenes ?? [];
    const live = boards.find((b) => b.isActive);
    if (!isDm) return live ? <span className={styles.boardName}>{live.name}</span> : null;
    return (
        <label className={styles.selector}>
            <span className={styles.selectorLabel}>Board</span>
            {/* choosing a board puts it on everyone's table at once */}
            <select value={live?.id ?? ''} disabled={setLive.isPending}
                onChange={(e) => setLive.mutate(Number(e.target.value))} aria-label="Board on the table">
                {boards.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
        </label>
    );
}

// ---- Map Editor: the DM's boards ----

// compact: a small panel over the editor's board; otherwise the full page you land on from the campaign
export function BoardLibrary({ campId, currentId, compact = false }: { campId: string; currentId: number | null; compact?: boolean }) {
    const navigate = useNavigate();
    const { data, error } = useBoards(campId);
    const create = useCreateBoard(campId);
    const rename = useRenameBoard(campId);
    const remove = useDeleteBoard(campId);
    const setLive = useSetLiveBoard(campId);
    const [newName, setNewName] = useState('');
    const [renaming, setRenaming] = useState<{ id: number; name: string } | null>(null);
    const [deleting, setDeleting] = useState<number | null>(null);
    const [open, setOpen] = useState(!compact);
    const [message, setMessage] = useState('');
    const fail = { onError: (err: unknown) => setMessage(messageOf(err)) };
    const boards = data?.scenes ?? [];
    const openBoard = (id: number) => navigate(`/campaign/${campId}/maps/${id}`);

    function makeBoard(copyFrom?: number) {
        const name = copyFrom ? `${boards.find((b) => b.id === copyFrom)?.name ?? 'Board'} (copy)` : newName.trim();
        if (!name) return setMessage('Give the new board a name');
        create.mutate({ name, copyFrom }, { ...fail, onSuccess: (made) => { setNewName(''); setMessage(''); openBoard(made.id); } });
    }

    if (compact && !open) {
        return <button type="button" className={`${styles.panel} ${styles.compact} ${styles.opener}`} onClick={() => setOpen(true)}>Boards ▸</button>;
    }
    return (
        <section className={compact ? `${styles.panel} ${styles.compact}` : `${styles.panel} ${styles.page}`} aria-label="Boards">
            <header className={styles.header}>
                <h2 className={styles.title}>Map Editor</h2>
                {compact
                    ? <button type="button" className={styles.small} onClick={() => setOpen(false)}>Hide ◂</button>
                    : <Link className={styles.small} to={`/campaign/${campId}`}>Back to the campaign</Link>}
            </header>
            {error && <p className={styles.error} role="alert">{messageOf(error)}</p>}

            <ul className={styles.list}>
                {boards.map((b: BoardInfo) => (
                    <li key={b.id} className={b.id === currentId ? `${styles.item} ${styles.current}` : styles.item}>
                        {renaming?.id === b.id ? (
                            <form className={styles.renameForm} onSubmit={(e) => {
                                e.preventDefault();
                                rename.mutate({ id: b.id, name: renaming.name.trim() }, { ...fail, onSuccess: () => setRenaming(null) });
                            }}>
                                <input autoFocus maxLength={60} value={renaming.name} aria-label="Board name"
                                    onChange={(e) => setRenaming({ id: b.id, name: e.target.value })} />
                                <button type="submit" className={styles.small}>Save</button>
                                <button type="button" className={styles.small} onClick={() => setRenaming(null)}>Cancel</button>
                            </form>
                        ) : (
                            <>
                                <button type="button" className={styles.open} onClick={() => openBoard(b.id)}>
                                    {b.name}
                                    {b.isActive && <span className={styles.live}>on the table</span>}
                                </button>
                                <span className={styles.actions}>
                                    {!b.isActive && <button type="button" className={styles.small} onClick={() => setLive.mutate(b.id, fail)}>Put on table</button>}
                                    <button type="button" className={styles.small} onClick={() => setRenaming({ id: b.id, name: b.name })}>Rename</button>
                                    <button type="button" className={styles.small} onClick={() => makeBoard(b.id)}>Copy</button>
                                    {!b.isActive && (deleting === b.id ? (
                                        <>
                                            <button type="button" className={`${styles.small} ${styles.danger}`} onClick={() => {
                                                remove.mutate(b.id, { ...fail, onSuccess: () => { setDeleting(null); if (b.id === currentId) navigate(`/campaign/${campId}/maps`); } });
                                            }}>Delete it</button>
                                            <button type="button" className={styles.small} onClick={() => setDeleting(null)}>Keep</button>
                                        </>
                                    ) : <button type="button" className={styles.small} onClick={() => setDeleting(b.id)}>Delete</button>)}
                                </span>
                            </>
                        )}
                    </li>
                ))}
                {data && boards.length === 0 && <li className={styles.item}>No boards yet: make the first one below.</li>}
            </ul>

            {/* a new, empty board */}
            <form className={styles.newForm} onSubmit={(e) => { e.preventDefault(); makeBoard(); }}>
                <input maxLength={60} placeholder="New board's name (e.g. Goblin Cave)" aria-label="New board's name"
                    value={newName} onChange={(e) => setNewName(e.target.value)} />
                <button type="submit" className={styles.small} disabled={create.isPending}>New board</button>
            </form>
            {message && <p className={styles.error} role="alert">{message}</p>}
            {compact && <Link className={styles.small} to={`/campaign/${campId}/table`}>Go to the play session</Link>}
        </section>
    );
}

// ---- Measure: a line of hexes and how far it is ----

export function MeasureLine({ from, to, heights, labels }: { from: Hex; to: Hex; heights: Record<string, number>; labels: RefObject<HTMLDivElement | null> }) {
    const hexes = hexLine(from, to);
    const steps = distance(from, to);
    const [x, , z] = hexToWorld(to, 1);
    return (
        <>
            <HexPatches hexes={hexes} color="#9fd2ff" opacity={0.35} heights={heights} y={0.115} />
            <Html position={[x, 0.6 + liftOf(heights, to), z]} center pointerEvents="none" portal={labels as RefObject<HTMLElement>}>
                <span className={styles.measure}>{steps} {steps === 1 ? 'hex' : 'hexes'} · {steps * 5} ft</span>
            </Html>
        </>
    );
}
