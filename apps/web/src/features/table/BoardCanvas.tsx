import { memo } from 'react'
import { styleOf, gridOf } from '@tenebris/rules/board'
import { Terrain, Tabletop } from './TableScenery.tsx'
import { BoardFeatures } from './BoardFeatures.tsx'
import { Grass, TurnSpotlight, TurnRing } from './BoardMoments.tsx'
import { MapPicture, Room, Weather } from './BoardWorld.tsx'
import { Torches, BoardLights, Dust, BoardEffects } from './BoardAtmosphere.tsx'
import { type TableController } from './useTableController.ts'
import { Canvas } from '@react-three/fiber'
import { startZoom } from './tableUtils.ts'
import { tableDebug } from './tableDebug.ts'
import { FrameWatch } from './FrameWatch.tsx'
import { StatsGl } from '@react-three/drei'
import { HoverLayer } from './HoverLayer.tsx'
import { Overlays, AreaFlash, Fog } from './BoardActs.tsx'
import { TokenOnBoard } from './TokenOnBoard.tsx'
import { BoardCamera } from './BoardCamera.tsx'
import { HexGrid } from './HexGrid.tsx'
import { useGraphics } from './graphicsSettings.ts'

// The 3D board: the room, the table, the hexes, tokens, effects and camera (R3F).
// memo: these redraw only when their own props change (not every time anything on the page changes)
const StillTerrain = memo(Terrain);
const StillFeatures = memo(BoardFeatures);
const StillGrass = memo(Grass);
const StillMap = memo(MapPicture);
const StillTorches = memo(Torches);

export function BoardCanvas({ c }: { c: TableController }) {
    const { radius, hexes, data, terrain, move, view, fitKey, surfaces, features, walls, look, heights, mood, showPerf, noEffects, grassHexes, tool, selected, boardRef, woodColor, surfaceColor, isDm, tokens, overlays, fog, acting, brush, painting, shapeOrigin, newest, notices, selectedToken, currentAt, onHexClick, onStroke, onTokenClick, mode } = c;
    const graphics = useGraphics();
    const style = styleOf(look);              // T1: Tiles or Natural
    return (
            <Canvas key={graphics.level} shadows={graphics.shadows !== 'off'} orthographic dpr={graphics.dpr} gl={{ antialias: graphics.antialias }} camera={{ position: [0, 100, 0], zoom: startZoom() }}>
                {tableDebug && <FrameWatch />}
                {showPerf && <StatsGl />}
                {/* the lamp over the table, the room light and reflections (BoardAtmosphere.tsx) */}
                <BoardLights mood={mood} moodName={look.mood ?? 'day'} radius={radius} shadowMapSize={graphics.shadowMapSize} castShadow={graphics.shadows !== 'off'} />

                {/* the room around the table: its colour comes from the scene's mood (BoardWorld.tsx) */}
                <color attach="background" args={[mood.background]} />

                {/* the felt tabletop and the wooden rim (TableScenery.tsx); with the room on, a real table with candles */}
                <Tabletop wood={woodColor} surface={surfaceColor} felt={!look.room} radius={radius} />
                {look.room && <Room felt={surfaceColor} radius={radius} />}

                {/* the hexes: terrain, raised walls, raised ground (TableScenery.tsx); Natural = one blended ground (TableNatural.tsx) */}
                <StillTerrain hexes={hexes} terrain={terrain} surfaces={surfaces} heights={heights} onHexClick={onHexClick} style={style} radius={radius} />
                {/* the DM's map picture over the hexes, if there is one */}
                <StillMap map={look.map} />
                <StillGrass hexes={grassHexes} heights={heights} />
                {/* the hex under the mouse glows, and a selected token shows the way it would walk */}
                <HoverLayer radius={radius} heights={heights} walls={walls} onHexClick={onHexClick} brush={painting ? brush : null} onStroke={onStroke}
                    measuring={tool.type === 'measure'} labels={boardRef} walker={tool.type === 'move' && !acting ? selectedToken : null}
                    preview={acting?.mode === 'area' && selectedToken ? { kind: acting.kind, sizeFt: acting.sizeFt, from: selectedToken }
                        : tool.type === 'shape' && (shapeOrigin || (tool.kind !== 'cone' && tool.kind !== 'line')) ? { kind: tool.kind, sizeFt: tool.sizeFt, from: shapeOrigin }
                        : null} />
                {/* step 17: shapes left on the board, and the flash of what an action just hit (BoardActs.tsx) */}
                <Overlays overlays={overlays} userId={data?.userId ?? 0} heights={heights} labels={boardRef} />
                <AreaFlash keys={newest?.area ?? null} flashId={newest?.id ?? null} heights={heights} />
                {/* step 18: the fog over what the party hasn't seen */}
                <Fog hexes={hexes} fog={fog} dm={isDm} />
                {/* T4: thin hex lines from a shader on one sheet (not as objects). Off = the sheet is not drawn. */}
                <HexGrid radius={radius} heights={heights} mode={gridOf(look)} />
                {/* what the DM placed: lights, trees, pillars, crates... (BoardFeatures.tsx) */}
                <StillFeatures features={features} heights={heights} onHexClick={onHexClick} />
                {tokens.map((token) => (
                    <TokenOnBoard key={token.id} token={token} mine={token.ownerId === data?.userId} labels={boardRef}
                        walls={walls} heights={heights} selected={token.id === selected} notice={notices.get(token.id) ?? null} onPick={onTokenClick} />
                ))}
                
                {/* the camera: frames the board, glides between views, DM can still pan / turn / zoom (BoardCamera.tsx) */}
                <BoardCamera view={view} fitKey={fitKey} focus={currentAt} painting={painting || tool.type === 'measure'} radius={radius} />

                {/* whose turn it is: a soft spotlight and a glowing ring under them (BoardMoments.tsx) */}
                <TurnSpotlight at={currentAt} />
                <TurnRing at={currentAt} />

                {/* the weather: fog, rain or snow (BoardWorld.tsx) */}
                <Weather weather={look.weather} radius={radius} />

                {/* small life: torches on a few walls, dust in the lamp light */}
                <StillTorches terrain={terrain} />
                <Dust color={mood.dust} radius={radius} />

                {/* the finishing touches, like a camera lens: soft shadows where things meet, glow, vignette */}
                {/* ?nofx turns the lens effects off: a quick way to test whether they cause a problem */}
                {!noEffects && <BoardEffects mood={mood} />}
            </Canvas>
    );
}
