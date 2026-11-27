import { type TableController } from './useTableController.ts'
import { Toolbar } from './Toolbar.tsx'
import { messageOf } from './tableUtils.ts'
import { ActPanel } from './ActPanel.tsx'
import { ShapeList } from './ShapePanels.tsx'
import { Feed } from './Feed.tsx'
import { TurnBar } from './TurnBar.tsx'
import { BoardSelector } from './BoardLibrary.tsx'
import { BoardSize } from './BoardSize.tsx'
import { radiusOf } from '@tenebris/rules/board'
import styles from './TablePanels.module.css'

// The tools, the feed, the turn order and the view buttons laid over the board (the Canvas itself is BoardCanvas.tsx).
export function TablePanels({ c }: { c: TableController }) {
    const { campId, editing, data, move, remove, view, setView, fitKey, setFitKey, look, setLook, tool, setTool, setSelected, placing, setPlacing, summonName, setSummonName, summonOwner, setSummonOwner, message, setMessage, isDm, tokens, overlays, feed, removeOverlay, resetFog, acting, setActing, brush, setBrush, clearMap, shapeOrigin, selectedToken, turns, canMove, done, mode } = c;
    const scene = data?.scene;
    return (
        <>
            <Toolbar
                mode={mode}
                data={data}
                tool={tool}
                setTool={(t) => { setTool(t); setSelected(null); setMessage(''); }}
                placing={placing} setPlacing={setPlacing}
                summonName={summonName} setSummonName={setSummonName}
                summonOwner={summonOwner} setSummonOwner={setSummonOwner}
                selectedToken={selectedToken}
                onLook={(change) => data?.scene && setLook.mutate({ sceneId: data.scene.id, ...change }, done)}
                look={look}
                onRemove={() => selectedToken && remove.mutate(selectedToken.id, { onSuccess: () => { setSelected(null); setMessage(''); }, onError: (err) => setMessage(messageOf(err)) })}
                onResetFog={() => data?.scene && resetFog.mutate(data.scene.id, { onError: (err) => setMessage(messageOf(err)) })}
                onClearMap={() => data?.scene && clearMap.mutate(data.scene.id, done)}
                brush={brush} setBrush={setBrush}
                boardSize={mode === 'editor' && scene ? (
                    <BoardSize value={radiusOf(scene.look)} error={setLook.error ? messageOf(setLook.error) : undefined}
                        onChange={(radius) => setLook.mutate({ sceneId: scene.id, radius }, done)} />
                ) : undefined}
                message={message || (acting ? (acting.mode === 'target' ? `${acting.choice.name}: click the target` : `${acting.choice.name}: click where the ${acting.kind} goes`) : '')
                    || (tool.type === 'shape' ? (shapeOrigin ? 'Now click where it points' : (tool.kind === 'cone' || tool.kind === 'line') ? 'Click where it starts' : 'Click where it goes') : '')}>
                {/* step 17: what the selected token can do */}
                {selectedToken && tool.type === 'move' && canMove(selectedToken) && (
                    <ActPanel token={selectedToken} acting={acting} setActing={(a) => { setActing(a); setMessage(''); }} />
                )}
                {tool.type === 'shape' && (
                    <ShapeList overlays={overlays} userId={data?.userId ?? 0} isDm={isDm}
                        onRemove={(id) => removeOverlay.mutate(id, { onError: (err) => setMessage(messageOf(err)) })} />
                )}
            </Toolbar>
            {/* step 17: what just happened (play session) */}
            {!editing && <Feed entries={feed} />}
            {/* the turn order, portraits across the top (TurnBar.tsx) */}
            <TurnBar turns={turns} tokens={tokens} />
            <div className={styles.viewButtons}>
                {/* play session: which board is on the table (the DM can switch it) */}
                {!editing && <BoardSelector campId={campId} isDm={isDm} />}
                <button type="button" className={styles.viewButton} onClick={() => setView(view === 'top' ? 'tilt' : 'top')}>
                    {view === 'top' ? 'Tilt view' : 'Top-down'}
                </button>
                <button type="button" className={styles.viewButton} onClick={() => setFitKey(fitKey + 1)}>Fit</button>
            </div>

        </>
    );
}
