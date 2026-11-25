// The table (Stage 2, steps 11–13): the map, a hex grid over it, painted terrain and tokens, drawn with R3F from a
// camera looking straight down. Everything that changes goes to the server, which decides (sceneController.js):
// the board only asks and shows the answer.
//
// Tools: everyone can Move (click your token, then a hex). The DM also gets the terrain brushes, Place and Remove.
import { Suspense, useRef, useState, type RefObject, useEffect, useMemo, memo, useCallback, type ReactNode } from 'react'
import { useParams } from 'react-router'
import { Canvas, type ThreeEvent, useFrame } from '@react-three/fiber'
import { Html, useTexture, Billboard, StatsGl } from '@react-three/drei'
import { type Hex, hexKey, hexesWithin, TERRAIN_KINDS, type TerrainKind, SURFACES, type Surface, FEATURE_KINDS, type FeatureKind, findPath, wallsOf, SCENE_MOODS, SCENE_WEATHERS, MAX_HEIGHT, type SceneLook, onBoard, BOARD_RADIUS } from '@tenebris/rules/board'
import { ApiError } from '../../api.ts'
import {
    useScene, usePaint, usePlaceToken, useMoveToken, useRemoveToken, useTableSync, useSetLook,
    useTableFeed, useTokenActions, useTableAct, useAddOverlay, useRemoveOverlay, useResetFog, type FeedEntry, type Overlay,
    useClearMap, type Brush,
    type PlaceRequest, type SceneData, type Token,
} from './tableQueries.ts'
import styles from './TablePage.module.css'
import { useCssColor } from '../../hooks/useCssColor.ts'
import { BoardCamera, type BoardView } from './BoardCamera.tsx'
import { BoardLights, BoardEffects, Dust, Torches } from './BoardAtmosphere.tsx'
import { BoardFeatures, FEATURE_LOOK } from './BoardFeatures.tsx'
import { GRID_RADIUS, RIM_OUTER, hexToWorld, worldToHex, liftOf, Terrain, Tabletop, SURFACE_LOOK } from './TableScenery.tsx'
import { moodOf, Weather, Room, MapPicture } from './BoardWorld.tsx'
import { TurnSpotlight, TurnRing, HoverGlow, PathPreview, Grass, HitBurst } from './BoardMoments.tsx'
import { TurnBar, tokenFor } from './TurnBar.tsx'
import { Fog, Overlays, AreaPreview, AreaFlash, HexPatches } from './BoardActs.tsx'
import { AREA_KINDS, type AreaKind, type Area, hexLine } from '@tenebris/rules/sight'
import type { ActChoice } from '@tenebris/rules/combat'
import { tableDebug, debugLog, debugDraw } from './tableDebug.ts'
import { BoardSelector, MeasureLine } from './BoardLibrary.tsx'
import { BufferGeometry, Float32BufferAttribute, Group, CanvasTexture, TextureLoader, SRGBColorSpace, type Texture, type MeshStandardMaterial } from 'three'



// memo: these redraw only when their own props change (not every time anything on the page changes)
const StillTerrain = memo(Terrain);
const StillFeatures = memo(BoardFeatures);
const StillGrass = memo(Grass);
const StillMap = memo(MapPicture);
const StillTorches = memo(Torches);

// Starting zoom (pixels per world unit): about 17 units of map across the screen, so a phone shows as much map
// as a laptop, just smaller. Scroll or pinch changes it after that.
const startZoom = () => Math.max(20, Math.min(75, Math.round(window.innerWidth / 17)));

// Every hex's outline in one list of line pieces (2 points per edge), so the whole grid is one draw call.
// Flat-top hexes: corners at 0°, 60°, 120°...
function gridLines(hexes: Hex[], heights: Record<string, number>) {
    const points: number[] = [];
    for (const hex of hexes) {
        const [cx, , cz] = hexToWorld(hex, 1);
        const y = liftOf(heights, hex);
        for (let k = 0; k < 6; k++) {
            const a1 = (k * Math.PI) / 3, a2 = ((k + 1) * Math.PI) / 3;
            points.push(cx + Math.cos(a1), y, cz + Math.sin(a1), cx + Math.cos(a2), y, cz + Math.sin(a2));
        }
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(points, 3));   // every 3 numbers = one point
    return g;
}

// Token colours: yours, another player's, a monster (the DM's), a summon
const TOKEN_COLORS = { mine: '#3fae6a', player: '#4d8fe0', monster: '#d0503c', summon: '#e0a63b', down: '#5a5a5a' };

function MapImage() {
     const texture = useTexture('/topdowncabin.webp');
    const height = 20 * ((texture.image as HTMLImageElement).height / (texture.image as HTMLImageElement).width);
    return (
        <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, -0.11, 0]}>
            <planeGeometry args={[20, height]} />
            <meshBasicMaterial map={texture} />
        </mesh>
    )
}

// What a click on a hex does
type Tool =
    | { type: 'move' }
    | { type: 'paint'; terrain: TerrainKind | null }     // the rules (wall, water...)
    | { type: 'erase' }                                  // the eraser: terrain, ground, what's placed and height all go
    | { type: 'surface'; surface: Surface | null }       // the look; null = back to the default ground
    | { type: 'feature'; kind: FeatureKind | null; size: number; color: string }   // place a light, tree...; null = remove
    | { type: 'place' }
    | { type: 'height'; height: number }                 // raise the ground (0 = flat)
    | { type: 'scene' }                                  // the scene's mood, weather, room and map picture
    | { type: 'shape'; kind: AreaKind; sizeFt: number; turns: number; name: string }    // draw a shape (anyone)
    | { type: 'measure' };                               // drag from one hex to another: how far (anyone, play session)

// Step 17: an action picked from the Act menu, waiting for its target (a token) or its area (a hex)
type Acting = { choice: ActChoice; castLevel: number | null; mode: 'target' | 'area'; kind: AreaKind; sizeFt: number; keepTurns: number };
const SIZES_FT = [5, 10, 15, 20, 30, 40, 60];
// What "size" means for each shape: a circle's radius (a 20 ft radius is 45 ft across), a square's width, a cone or line's length
const SIZE_WORD: Record<AreaKind, string> = { circle: 'Radius', square: 'Width', cone: 'Length', line: 'Length' };

// A click that ended a drag (panning the map) isn't a click
const wasDrag = (e: ThreeEvent<MouseEvent>) => e.delta > 4;

const messageOf = (err: unknown) => (err instanceof ApiError || err instanceof Error ? err.message : 'Something went wrong');


// mode: 'session' = Play Session (tokens, moving, acting, shapes, measuring, fog, the turn bar, the board selector);
//       'editor'  = Map Editor for one board (painting, erasing, features, heights, the board's look; no combat).
export default function TablePage({ mode = 'session', editSceneId = null }: { mode?: 'session' | 'editor'; editSceneId?: number | null }) {
    debugDraw('TablePage');
    const hexes = useMemo(() => hexesWithin({ q: 0, r: 0 }, GRID_RADIUS), []);   // the grid never changes: work it out once
    const { campId = '' } = useParams();
    const editing = mode === 'editor';
    const board = editing && editSceneId ? `${campId}@${editSceneId}` : campId;   // which board this page shows (tableQueries)
    const { data, error } = useScene(board);
    const terrain = data?.scene?.terrain ?? {};
    const paint = usePaint(board);
    const place = usePlaceToken(board);
    const move = useMoveToken(board);
    const remove = useRemoveToken(board);
    useTableSync(board);                       // other people's paints and moves appear here as they happen
    const [view, setView] = useState<BoardView>('tilt');                // the TV's default: a slight angle across the table
    const [fitKey, setFitKey] = useState(0);                            // counts up each Fit: the camera glides back to the whole board
    const surfaces = data?.scene?.surfaces ?? {};
    const features = data?.scene?.features ?? {};
    const walls = useMemo(() => wallsOf(terrain, features), [terrain, features]);   // walls + trees, boulders, pillars
    const look: SceneLook = data?.scene?.look ?? {};
    const heights = useMemo(() => look.heights ?? {}, [look.heights]);
    const mood = moodOf(look.mood);
    const setLook = useSetLook(board);
    // sharpness: fixed for the whole visit. (Changing it on the fly resized the drawing surface mid-game, which
    // flashed a black box over part of the screen.)
    const dpr = Math.min(2, window.devicePixelRatio);
    const showPerf = new URLSearchParams(window.location.search).has('perf');   // /table?perf shows a frame counter
    const noEffects = new URLSearchParams(window.location.search).has('nofx');
    // grass blades grow on every grass hex (the default ground) that isn't wall or water
    const grassHexes = useMemo(() => hexes.filter((h) => {
        const key = hexKey(h);
        return (surfaces[key] ?? 'grass') === 'grass' && terrain[key] !== 'wall' && terrain[key] !== 'water' && !features[key];
    }), [hexes, surfaces, terrain, features]);
    const [tool, setTool] = useState<Tool>({ type: 'move' });
    const [selected, setSelected] = useState<number | null>(null);    // the token about to move
    const [placing, setPlacing] = useState('');                       // 'character:3', 'monster:7' or 'summon'
    const [summonName, setSummonName] = useState('');
    const [summonOwner, setSummonOwner] = useState('');               // a player's user id, or '' for the DM
    const [message, setMessage] = useState('');
    // Token names are page elements drawn over the board. They go in the board's own box: without a box named
    // here, drei puts them next to the canvas, and the first one can be made before that spot exists and get lost.
    const boardRef = useRef<HTMLDivElement>(null);
    const woodColor = useCssColor('--table-wood', '#5b3a22');
    const surfaceColor = useCssColor('--table-surface', '#2a1d14');
    const lines = useMemo(() => gridLines(hexes, heights), [hexes, heights]);


    const isDm = data?.isDm ?? false;
    const tokens = data?.tokens ?? [];
    // ---- step 17: acting, shapes on the board, the feed. Step 18: the fog. ----
    const overlays = data?.overlays ?? NO_OVERLAYS;
    const fog = editing ? null : data?.fog ?? null;     // the editor always shows the whole board
    const feed = useTableFeed(board).data;
    const tableAct = useTableAct(board);
    const addOverlay = useAddOverlay();
    const removeOverlay = useRemoveOverlay();
    const resetFog = useResetFog();
    const [acting, setActing] = useState<Acting | null>(null);
    // ---- the map editor: paint tools work by clicking or dragging; brush = how many rings around the mouse ----
    const [brush, setBrush] = useState(0);
    const clearMap = useClearMap(board);
    const painting = isDm && PAINT_TOOLS.includes(tool.type);
    function paintHexes(hexes: Hex[]) {
        const what = brushOf(tool);
        if (!data?.scene || !what || hexes.length === 0) return;
        paint.mutate({ sceneId: data.scene.id, hexes, ...what }, done);
    }
    const [shapeOrigin, setShapeOrigin] = useState<Hex | null>(null);     // cones and lines: the first click
    useEffect(() => setActing(null), [selected]);                         // a new selection starts fresh
    // the newest feed entry: its area flashes; its misses and saves float over their tokens
    const newest = feed[0] ?? null;
    const notices = useMemo(() => noticesFrom(newest), [newest]);
    const selectedToken = tokens.find((t) => t.id === selected) ?? null;
    // whose turn it is, and where they stand (for the spotlight, the ring and the camera)
    const turns = editing ? null : data?.turns ?? null;   // the editor has no turn order on show
    const current = turns && turns.order.length > 0 ? tokenFor(turns.order[turns.turn % turns.order.length], tokens) : null;
    const currentAt = useMemo<[number, number, number] | null>(() => {
        if (!current) return null;
        const [x, , z] = hexToWorld(current, 1);
        return [x, 0.1 + liftOf(heights, current), z];
    }, [current?.q, current?.r, heights]);

    const canMove = (t: Token) => isDm || t.ownerId === data?.userId;
    const done = { onSuccess: () => setMessage(''), onError: (err: unknown) => setMessage(messageOf(err)) };

    // The token to place, from the Place picker
    function placeRequest(): PlaceRequest | null {
        const [kind, id] = placing.split(':');
        if (kind === 'character') return { kind, characterId: Number(id) };
        if (kind === 'monster') return { kind, campaignMonsterId: Number(id) };
        if (kind === 'summon') return { kind, name: summonName, ownerId: summonOwner ? Number(summonOwner) : null };
        return null;
    }

    function clickHex(hex: Hex, e: ThreeEvent<MouseEvent>) {
        if (wasDrag(e) || !data?.scene) return;
        const sceneId = data.scene.id;
        if (acting && selectedToken && acting.mode === 'area') {
            const area: Area = { kind: acting.kind, at: hex, sizeFt: acting.sizeFt };
            tableAct.mutate({ tokenId: selectedToken.id, actionKey: acting.choice.key, castLevel: acting.castLevel ?? undefined, area, keepTurns: acting.keepTurns },
                { onSuccess: () => { setActing(null); setMessage(''); }, onError: (err) => setMessage(messageOf(err)) });
        } else if (tool.type === 'shape') {
            const pointed = tool.kind === 'cone' || tool.kind === 'line';
            if (pointed && !shapeOrigin) { setShapeOrigin(hex); return setMessage('Now click where it points'); }
            addOverlay.mutate({ sceneId, name: tool.name.trim() || undefined, area: { kind: tool.kind, at: hex, sizeFt: tool.sizeFt }, from: shapeOrigin ?? hex, turns: tool.turns || null },
                { onSuccess: () => { setShapeOrigin(null); setMessage(''); }, onError: (err) => { setShapeOrigin(null); setMessage(messageOf(err)); } });
        } else if (painting) {
            paintHexes(brushAround(hex, brush));      // a click on a wall or a placed tree (clicks on open ground come as strokes)
        } else if (tool.type === 'place' && isDm) {
            const request = placeRequest();
            if (!request) return setMessage('Choose what to place first');
            place.mutate({ sceneId, q: hex.q, r: hex.r, place: request }, done);
        } else if (tool.type === 'move' && selectedToken) {
            move.mutate({ tokenId: selectedToken.id, q: hex.q, r: hex.r }, {
                onSuccess: () => { setMessage(''); setSelected(null); },
                onError: (err) => setMessage(messageOf(err)),
            });
        }
    }

    // The board's pieces get these two, which never change, instead of clickHex / clickToken (new on every draw).
    // A piece whose props didn't change can then skip redrawing (memo, below): moving one token no longer
    // redraws every hex, rock and blade of grass.
    const latest = useRef({ clickHex, clickToken: (t: Token, e: ThreeEvent<MouseEvent>) => clickToken(t, e) });
    latest.current = { clickHex, clickToken: (t: Token, e: ThreeEvent<MouseEvent>) => clickToken(t, e) };
    const onHexClick = useCallback((hex: Hex, e: ThreeEvent<MouseEvent>) => latest.current.clickHex(hex, e), []);
    const paintLatest = useRef(paintHexes);
    paintLatest.current = paintHexes;
    const onStroke = useCallback((hexes: Hex[]) => paintLatest.current(hexes), []);
    const onTokenClick = useCallback((t: Token, e: ThreeEvent<MouseEvent>) => latest.current.clickToken(t, e), []);

    function clickToken(token: Token, e: ThreeEvent<MouseEvent>) {
        if (acting && selectedToken) {               // step 17: the click picks the target (or the area's hex)
            e.stopPropagation();
            if (wasDrag(e)) return;
            if (acting.mode === 'area') return clickHex({ q: token.q, r: token.r }, e);
            tableAct.mutate({ tokenId: selectedToken.id, actionKey: acting.choice.key, castLevel: acting.castLevel ?? undefined, target: token.id },
                { onSuccess: () => { setActing(null); setMessage(''); }, onError: (err) => setMessage(messageOf(err)) });
            return;
        }
        if (tool.type !== 'move') return;           // other tools act on the hex underneath
        e.stopPropagation();                        // don't also click the hex below
        if (wasDrag(e)) return;
        if (!canMove(token)) return setMessage(`${token.name} isn't yours to move`);
        setMessage('');
        setSelected(selected === token.id ? null : token.id);
    }

    if (error) return <p className={styles.notice} role="alert">{messageOf(error)}</p>;
    if (data && !data.scene) return <p className={styles.notice}>The DM hasn't opened the table yet.</p>;



    return (
        <div className={styles.board} ref={boardRef}>
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

            <Canvas shadows orthographic dpr={dpr} camera={{ position: [0, 100, 0], zoom: startZoom() }}>
                {tableDebug && <FrameWatch />}
                {showPerf && <StatsGl />}
                {/* the lamp over the table, the room light and reflections (BoardAtmosphere.tsx) */}
                <BoardLights mood={mood} />

                {/* the room around the table: its colour comes from the scene's mood (BoardWorld.tsx) */}
                <color attach="background" args={[mood.background]} />

                {/* the felt tabletop and the wooden rim (TableScenery.tsx); with the room on, a real table with candles */}
                <Tabletop wood={woodColor} surface={surfaceColor} felt={!look.room} />
                {look.room && <Room felt={surfaceColor} />}

                {/* the hexes: terrain, raised walls, raised ground (TableScenery.tsx) */}
                <StillTerrain hexes={hexes} terrain={terrain} surfaces={surfaces} heights={heights} onHexClick={onHexClick} />
                {/* the DM's map picture over the hexes, if there is one */}
                <StillMap map={look.map} />
                <StillGrass hexes={grassHexes} heights={heights} />
                {/* the hex under the mouse glows, and a selected token shows the way it would walk */}
                <HoverLayer heights={heights} walls={walls} onHexClick={onHexClick} brush={painting ? brush : null} onStroke={onStroke}
                    measuring={tool.type === 'measure'} labels={boardRef} walker={tool.type === 'move' && !acting ? selectedToken : null}
                    preview={acting?.mode === 'area' && selectedToken ? { kind: acting.kind, sizeFt: acting.sizeFt, from: selectedToken }
                        : tool.type === 'shape' && (shapeOrigin || (tool.kind !== 'cone' && tool.kind !== 'line')) ? { kind: tool.kind, sizeFt: tool.sizeFt, from: shapeOrigin }
                        : null} />
                {/* step 17: shapes left on the board, and the flash of what an action just hit (BoardActs.tsx) */}
                <Overlays overlays={overlays} userId={data?.userId ?? 0} heights={heights} labels={boardRef} />
                <AreaFlash keys={newest?.area ?? null} flashId={newest?.id ?? null} heights={heights} />
                {/* step 18: the fog over what the party hasn't seen */}
                <Fog hexes={hexes} fog={fog} dm={isDm} />
                {/* thin grid lines just above the hexes */}
                <lineSegments geometry={lines} position={[0, 0.102, 0]}>
                    <lineBasicMaterial color="#000000" transparent opacity={0.25} />
                </lineSegments>
                {/* what the DM placed: lights, trees, pillars, crates... (BoardFeatures.tsx) */}
                <StillFeatures features={features} heights={heights} onHexClick={onHexClick} />
                {tokens.map((token) => (
                    <TokenOnBoard key={token.id} token={token} mine={token.ownerId === data?.userId} labels={boardRef}
                        walls={walls} heights={heights} selected={token.id === selected} notice={notices.get(token.id) ?? null} onPick={onTokenClick} />
                ))}
                
                {/* the camera: frames the board, glides between views, DM can still pan / turn / zoom (BoardCamera.tsx) */}
                <BoardCamera view={view} fitKey={fitKey} focus={currentAt} painting={painting || tool.type === 'measure'} />

                {/* whose turn it is: a soft spotlight and a glowing ring under them (BoardMoments.tsx) */}
                <TurnSpotlight at={currentAt} />
                <TurnRing at={currentAt} />

                {/* the weather: fog, rain or snow (BoardWorld.tsx) */}
                <Weather weather={look.weather} />

                {/* small life: torches on a few walls, dust in the lamp light */}
                <StillTorches terrain={terrain} />
                <Dust color={mood.dust} />

                {/* the finishing touches, like a camera lens: soft shadows where things meet, glow, vignette */}
                {/* ?nofx turns the lens effects off: a quick way to test whether they cause a problem */}
                {!noEffects && <BoardEffects mood={mood} />}
            </Canvas>
        </div>
    );
}

// How full the health ring is. Monsters only send a word, so players never learn their real HP.
const HEALTH_SHARE: Record<string, number> = { Unhurt: 1, Wounded: 0.75, Bloodied: 0.5, 'Near death': 0.25, Down: 0 };

// Load a portrait picture. Broken or blocked links give null (the token shows its colour) instead of crashing the board.
function usePortrait(url: string | null) {
    const [texture, setTexture] = useState<Texture | null>(null);
    useEffect(() => {
        setTexture(null);
        if (!url) return;
        let current = true;                       // ignore a slow load that finishes after the token changed or left
        new TextureLoader().load(url,
            (t) => { if (current) { t.colorSpace = SRGBColorSpace; setTexture(t); } },
            undefined,
            () => { if (current) setTexture(null); });
        return () => { current = false; };
    }, [url]);
    return texture;
}

// The standee's card: a framed picture in the owner's colour, bottom edge at its origin. With no portrait it shows the
// first letter of the name on the owner's colour. The picture is cropped to fill the card without stretching.
const CARD_W = 0.95, CARD_H = 1.3;

function letterCard(name: string, color: string) {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 350;
    const g = c.getContext('2d')!;
    const grad = g.createLinearGradient(0, 0, 0, c.height);
    grad.addColorStop(0, color); grad.addColorStop(1, '#1a1612');
    g.fillStyle = grad; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = 'rgba(255,255,255,0.92)';
    g.font = 'bold 170px Georgia, serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText((name.trim()[0] ?? '?').toUpperCase(), c.width / 2, c.height / 2);
    const t = new CanvasTexture(c);
    t.colorSpace = SRGBColorSpace;
    return t;
}

function StandeeCard({ portrait, name, color, onClick }: {
    portrait: Texture | null; name: string; color: string; onClick: (e: ThreeEvent<MouseEvent>) => void;
}) {
    const letter = useMemo(() => letterCard(name, color), [name, color]);
    // crop the portrait like CSS "object-fit: cover": fill the card, cut off what sticks out
    const picture = useMemo(() => {
        if (!portrait) return letter;
        const img = portrait.image as { width: number; height: number };
        const imageAspect = img.width / img.height, cardAspect = CARD_W / CARD_H;
        const t = portrait.clone();
        if (imageAspect > cardAspect) { t.repeat.set(cardAspect / imageAspect, 1); t.offset.set((1 - t.repeat.x) / 2, 0); }
        else { t.repeat.set(1, imageAspect / cardAspect); t.offset.set(0, (1 - t.repeat.y) / 2); }
        t.needsUpdate = true;
        return t;
    }, [portrait, letter]);
    return (
        <group onClick={onClick}>
            {/* the frame, a little bigger than the picture */}
            <mesh position={[0, CARD_H / 2 + 0.02, -0.006]} castShadow>
                <boxGeometry args={[CARD_W + 0.08, CARD_H + 0.08, 0.01]} />
                <meshPhysicalMaterial color={color} metalness={0.5} roughness={0.35} clearcoat={1} />
            </mesh>
            <mesh position={[0, CARD_H / 2 + 0.02, 0]}>
                <planeGeometry args={[CARD_W, CARD_H]} />
                <meshStandardMaterial map={picture} roughness={0.55} />
            </mesh>
        </group>
    );
}

// One token: a coin-edged base with the portrait on top, a health ring, and its name above it.
// It walks along its path when moved, and lifts off the board when selected.
function TokenPiece({ token, mine, selected, labels, walls, heights, notice, onClick }: {
    token: Token; mine: boolean; selected: boolean; labels: RefObject<HTMLDivElement | null>;
    walls: Set<string>; heights: Record<string, number>; notice: Notice | null; onClick: (e: ThreeEvent<MouseEvent>) => void;
}) {
    // ---- walking ----
    const piece = useRef<Group>(null);
    const shown = useRef<Hex>({ q: token.q, r: token.r });    // the hex the piece is drawn on right now
    const route = useRef<Hex[]>([]);                           // hexes still to walk through
    const step = useRef(0);                                    // 0 → 1: progress towards the next hex
    const start = useMemo(() => hexToWorld(token, 1), []);    // where it first appears (only used once)

    useEffect(() => {
        const from = shown.current;
        if (from.q === token.q && from.r === token.r) return;
        const path = findPath(from, token, walls, 200);
        route.current = path ? path.slice(1) : [{ q: token.q, r: token.r }];
        step.current = 0;
    }, [token.q, token.r]);

    // ---- lifting when selected, the ring's pulse, the landing bounce ----
    const lift = useRef<Group>(null);
    const ring = useRef<MeshStandardMaterial>(null);
    const bounce = useRef(0);                                  // 1 = just landed, eases back to 0

    useFrame((_, delta) => {
        // lift: ease towards 0.2 up when selected, back down when not
        const l = lift.current;
        if (l) l.position.y += ((selected ? 0.2 : 0) - l.position.y) * Math.min(1, delta * 12);

        // the selection ring breathes slowly, bright enough to glow
        if (ring.current) ring.current.emissiveIntensity = 1.6 + Math.sin(performance.now() / 300) * 0.6;

        // landing: squash a little and spring back (wider and flatter, then normal)
        if (l && bounce.current > 0) {
            bounce.current = Math.max(0, bounce.current - delta * 4);
            const b = Math.sin(bounce.current * Math.PI) * 0.12;
            l.scale.set(1 + b, 1 - b * 1.5, 1 + b);
        }

        // shake for a moment after a hit
        if (l && shake.current > 0) {
            shake.current = Math.max(0, shake.current - delta * 3);
            l.position.x = Math.sin(performance.now() / 18) * 0.06 * shake.current;
        } else if (l) l.position.x = 0;

        // walk: slide towards the next hex, with a small hop each step
        const g = piece.current;
        if (!g) return;
        if (route.current.length === 0) {
            // standing still: settle onto the ground's height (it may have been raised or lowered)
            g.position.y += (0.1 + liftOf(heights, shown.current) - g.position.y) * Math.min(1, delta * 10);
            return;
        }
        step.current = Math.min(1, step.current + delta / 0.15);
        const [ax, , az] = hexToWorld(shown.current, 1);
        const [bx, , bz] = hexToWorld(route.current[0], 1);
        const t = step.current;
        const ground = liftOf(heights, shown.current) + (liftOf(heights, route.current[0]) - liftOf(heights, shown.current)) * t;
        g.position.set(ax + (bx - ax) * t, 0.1 + ground + Math.sin(Math.PI * t) * 0.15, az + (bz - az) * t);
        if (t >= 1) {
            shown.current = route.current.shift()!;
            step.current = 0;
            if (route.current.length === 0) bounce.current = 1;   // that was the last hex: land with a bounce
        }
    });

    // ---- looks ----
    const portrait = usePortrait(token.portrait);
    const down = token.health === 'Down';
    const color = down ? TOKEN_COLORS.down
        : token.kind === 'monster' ? TOKEN_COLORS.monster
        : token.kind === 'summon' ? TOKEN_COLORS.summon
        : mine ? TOKEN_COLORS.mine : TOKEN_COLORS.player;
    const share = token.hp ? Math.max(0, token.hp.current) / token.hp.max : HEALTH_SHARE[token.health ?? ''] ?? 1;
    const ringColor = share > 0.5 ? '#4caf50' : share > 0.25 ? '#e0a63b' : '#d0503c';

    // ---- hurt and healed: a burst of light, a shake, and the change floating up ----
    const shake = useRef(0);
    const before = useRef({ hp: token.hp?.current ?? null, health: token.health ?? null });
    const [hits, setHits] = useState<{ id: number; text: string; heal: boolean; plain?: boolean }[]>([]);
    // a miss or a save shows nothing on the HP, so the feed's notice floats up instead (step 17)
    useEffect(() => {
        if (!notice) return;
        const id = Date.now() + Math.random();
        setHits((list) => [...list, { id, text: notice.text, heal: false, plain: true }]);
        const timer = setTimeout(() => setHits((list) => list.filter((h) => h.id !== id)), 1400);
        return () => clearTimeout(timer);
    }, [notice?.id]);
    useEffect(() => {
        const was = before.current;
        const now = { hp: token.hp?.current ?? null, health: token.health ?? null };
        before.current = now;
        let hit: { text: string; heal: boolean } | null = null;
        if (was.hp !== null && now.hp !== null && now.hp !== was.hp) {
            hit = { text: `${now.hp > was.hp ? '+' : ''}${now.hp - was.hp}`, heal: now.hp > was.hp };   // a character: the number
        } else if (was.hp === null && now.hp === null && now.health && was.health && now.health !== was.health) {
            const order = Object.keys(HEALTH_SHARE);                                                 // a monster: only the word
            hit = { text: now.health, heal: order.indexOf(now.health) < order.indexOf(was.health) };
        }
        if (!hit) return;
        const found = hit, id = Date.now();
        if (!found.heal) shake.current = 1;
        setHits((list) => [...list, { id, ...found }]);
        const timer = setTimeout(() => setHits((list) => list.filter((h) => h.id !== id)), 1400);
        return () => clearTimeout(timer);
    }, [token.hp?.current, token.health]);

    // under the name: a character's HP, a monster's health word (players never see its numbers), and conditions
    const health = token.hp ? `${token.hp.current}/${token.hp.max}${token.hp.temp > 0 ? ` +${token.hp.temp}` : ''}` : token.health;
    const details = [health, ...token.conditions].filter(Boolean).join(' · ');
    const label = (at: [number, number, number]) => (
        <Html position={at} center className={styles.label} wrapperClass={styles.labelWrap}
            pointerEvents="none" portal={labels as RefObject<HTMLElement>}>
            <span className={styles.labelName}>{token.name}</span>
            {details && <span className={styles.labelDetails}>{details}</span>}
        </Html>
    );

    return (
        <group ref={piece} position={[start[0], 0.1 + liftOf(heights, token), start[2]]}>
            {hits.map((h) => (
                <group key={h.id}>
                    {!h.plain && <HitBurst heal={h.heal} />}
                    <Html position={[0, CARD_H + 0.8, 0]} center pointerEvents="none" portal={labels as RefObject<HTMLElement>}>
                        <span className={h.plain ? `${styles.hit} ${styles.hitPlain}` : h.heal ? `${styles.hit} ${styles.hitHeal}` : styles.hit}>{h.text}</span>
                    </Html>
                </group>
            ))}
            {/* selected: a glowing gold ring left on the board under the lifted piece */}
            {selected && (
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
                    <ringGeometry args={[0.8, 0.95, 48]} />
                    <meshStandardMaterial ref={ring} color="#f5d061" emissive="#f5d061" emissiveIntensity={1.6} toneMapped={false} />
                </mesh>
            )}

            <group ref={lift}>
                {/* the stand: a metal disc in the owner's colour */}
                <mesh position={[0, 0.06, 0]} castShadow receiveShadow onClick={onClick}>
                    <cylinderGeometry args={[0.5, 0.55, 0.12, 40]} />
                    <meshPhysicalMaterial color={color} metalness={0.6} roughness={0.35} clearcoat={1} clearcoatRoughness={0.2} />
                </mesh>

                {/* the health ring around the foot of the card: starts at the top and goes round as far as their health */}
                {share > 0 && (
                    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.122, 0]}>
                        <ringGeometry args={[0.38, 0.48, 40, 1, Math.PI / 2, share * Math.PI * 2]} />
                        <meshStandardMaterial color={ringColor} emissive={ringColor} emissiveIntensity={0.4} />
                    </mesh>
                )}

                {/* the card: always turned to face the camera. When they're down, it falls over flat. */}
                {down ? (
                    <group position={[0, 0.14, 0.2]} rotation={[-Math.PI / 2, 0, 0]}>
                        <StandeeCard portrait={portrait} name={token.name} color={color} onClick={onClick} />
                    </group>
                ) : (
                    <Billboard position={[0, 0.12, 0]}>
                        <StandeeCard portrait={portrait} name={token.name} color={color} onClick={onClick} />
                        {/* the name rides on the card, so it's always just above it on screen */}
                        {label([0, CARD_H + 0.35, 0])}
                    </Billboard>
                )}
            </group>

            {/* a fallen standee's name sits just beyond it */}
            {down && label([0, 0.5, -0.9])}
        </group>
    );
}

// The tools above the board. Players see only their status line; the DM gets brushes, Place and Remove.
function Toolbar(props: {
    mode: 'session' | 'editor';
    data: SceneData | undefined;
    tool: Tool; setTool: (t: Tool) => void;
    placing: string; setPlacing: (v: string) => void;
    summonName: string; setSummonName: (v: string) => void;
    summonOwner: string; setSummonOwner: (v: string) => void;
    selectedToken: Token | null;
    onRemove: () => void;
    look: SceneLook;
    onLook: (change: Partial<SceneLook>) => void;
    onResetFog: () => void;
    onClearMap: () => void;
    brush: number; setBrush: (b: number) => void;
    message: string;
    children?: ReactNode;
}) {
    const { data, tool, setTool, selectedToken, message } = props;
    const isDm = data?.isDm ?? false;
    const pressed = (t: Tool) => tool.type === t.type && (t.type !== 'paint' || (tool.type === 'paint' && tool.terrain === t.terrain));
    const button = (label: string, t: Tool) => (
        <button type="button" className={pressed(t) ? `${styles.tool} ${styles.toolOn}` : styles.tool}
            aria-pressed={pressed(t)} onClick={() => setTool(t)}>{label}</button>
    );

    const status = message
        || (selectedToken ? `${selectedToken.name}: click a hex to move there` : '')
        || (tool.type === 'scene' ? (props.mode === 'editor' ? "This board's look when it's put on the table" : 'Change the mood for everyone at the table') : '')
        || (tool.type === 'measure' ? 'Drag from one hex to another to measure' : '')
        || (isDm && PAINT_TOOLS.includes(tool.type) ? 'Click or drag to paint · right-drag turns the camera' : '')
        || (tool.type === 'move' ? 'Click your token, then a hex' : tool.type === 'place' ? 'Click a hex to place it' : tool.type === 'surface' ? 'Click hexes to change the ground' : tool.type === 'feature' ? (tool.kind ? 'Click a hex to place it' : 'Click a feature to remove it') : 'Click hexes to paint');

    const shapeTool = tool.type === 'shape' ? tool : { type: 'shape' as const, kind: 'circle' as AreaKind, sizeFt: 10, turns: 0, name: '' };
    return (
        <div className={styles.toolbar} aria-label="Table tools">
            {/* players: move their tokens, draw shapes (spell areas, a wall of fire...), measure */}
            {!isDm && (
                <div className={styles.row}>
                    {button('Move', { type: 'move' })}
                    {button('Shapes', shapeTool)}
                    {button('Measure', { type: 'measure' })}
                </div>
            )}
            {tool.type === 'shape' && <ShapeControls tool={tool} setTool={setTool} />}
            {isDm && (
                <>
                    {props.mode === 'editor' ? (
                        // Map Editor: building the board
                        <div className={styles.row}>
                            {button('Move', { type: 'move' })}
                            {TERRAIN_KINDS.map((kind) => <span key={kind}>{button(kind[0].toUpperCase() + kind.slice(1), { type: 'paint', terrain: kind })}</span>)}
                            {button('Eraser', { type: 'erase' })}
                            {button('Surface', { type: 'surface', surface: tool.type === 'surface' ? tool.surface : 'cobble' })}
                            {button('Features', tool.type === 'feature' ? tool : { type: 'feature', kind: 'tree', size: 1, color: '#ffd08a' })}
                            {button('Height', tool.type === 'height' ? tool : { type: 'height', height: 1 })}
                            {button('Place', { type: 'place' })}
                            {button('Look', { type: 'scene' })}
                        </div>
                    ) : (
                        // Play Session: running the game
                        <div className={styles.row}>
                            {button('Move', { type: 'move' })}
                            {button('Place', { type: 'place' })}
                            {button('Shapes', shapeTool)}
                            {button('Measure', { type: 'measure' })}
                            {button('Scene', { type: 'scene' })}
                        </div>
                    )}
                    {/* the Height brush: how many levels up (0 = back to flat) */}
                    {tool.type === 'height' && (
                        <div className={styles.row}>
                            {Array.from({ length: MAX_HEIGHT + 1 }, (_, h) => (
                                <button key={h} type="button" aria-pressed={tool.height === h}
                                    className={tool.height === h ? `${styles.tool} ${styles.toolOn}` : styles.tool}
                                    onClick={() => setTool({ type: 'height', height: h })}>{h === 0 ? 'Flat' : `Up ${h}`}</button>
                            ))}
                        </div>
                    )}
                    {tool.type === 'scene' && <SceneControls mode={props.mode} look={props.look} onLook={props.onLook} onResetFog={props.onResetFog} onClearMap={props.onClearMap} />}
                    {/* the brush for every paint tool: one hex, or a ring or two around it */}
                    {PAINT_TOOLS.includes(tool.type) && (
                        <div className={styles.row}>
                            <span className={styles.field}>Brush:</span>
                            {BRUSHES.map(([label, rings]) => (
                                <button key={rings} type="button" aria-pressed={props.brush === rings}
                                    className={props.brush === rings ? `${styles.tool} ${styles.toolOn}` : styles.tool}
                                    onClick={() => props.setBrush(rings)}>{label}</button>
                            ))}
                        </div>
                    )}
                    {/* the Surface brush: one button per kind of ground, with a little picture of it */}
                    {tool.type === 'surface' && (
                        <div className={styles.row}>
                            {SURFACES.map((s) => (
                                <button key={s} type="button" aria-pressed={tool.surface === s}
                                    className={tool.surface === s ? `${styles.tool} ${styles.toolOn}` : styles.tool}
                                    onClick={() => setTool({ type: 'surface', surface: s })}>
                                    <span className={styles.swatch} style={{ background: SURFACE_LOOK[s].flat }} aria-hidden="true" />
                                    {SURFACE_LOOK[s].label}
                                </button>
                            ))}
                            <button type="button" aria-pressed={tool.surface === null}
                                className={tool.surface === null ? `${styles.tool} ${styles.toolOn}` : styles.tool}
                                onClick={() => setTool({ type: 'surface', surface: null })}>Clear</button>
                        </div>
                    )}
                    {/* the Features brush: what to place, its size, and a light's colour */}
                    {tool.type === 'feature' && (
                        <div className={styles.row}>
                            {FEATURE_KINDS.map((k) => (
                                <button key={k} type="button" aria-pressed={tool.kind === k}
                                    className={tool.kind === k ? `${styles.tool} ${styles.toolOn}` : styles.tool}
                                    onClick={() => setTool({ ...tool, kind: k })}>{FEATURE_LOOK[k].label}</button>
                            ))}
                            <button type="button" aria-pressed={tool.kind === null}
                                className={tool.kind === null ? `${styles.tool} ${styles.toolOn}` : styles.tool}
                                onClick={() => setTool({ ...tool, kind: null })}>Remove</button>
                            <label className={styles.field}>Size{' '}
                                <input className={styles.inputRange} type="range" min={0.5} max={2} step={0.1} value={tool.size}
                                    onChange={(e) => setTool({ ...tool, size: Number(e.target.value) })} />
                            </label>
                            {tool.kind === 'light' && (
                                <label className={styles.field}>Colour{' '}
                                    <input className={styles.inputColor} type="color" value={tool.color} onChange={(e) => setTool({ ...tool, color: e.target.value })} />
                                </label>
                            )}
                        </div>
                    )}
                    {tool.type === 'place' && (
                        <div className={styles.row}>
                            <select className={styles.select} value={props.placing} aria-label="What to place" onChange={(e) => props.setPlacing(e.target.value)}>
                                <option className={styles.option} value="">Choose…</option>
                                <optgroup label="Party">
                                    {data?.placeable?.party.map((p) => <option className={styles.option} key={p.characterId} value={`character:${p.characterId}`}>{p.name} ({p.username})</option>)}
                                </optgroup>
                                <optgroup label="Monsters">
                                    {data?.placeable?.monsters.map((m) => <option className={styles.option} key={m.id} value={`monster:${m.id}`}>{m.name}</option>)}
                                </optgroup>
                                <option className={styles.option} value="summon">A summon or pet…</option>
                            </select>
                            {props.placing === 'summon' && (
                                <>
                                    <input className={styles.input} type="text" maxLength={60} placeholder="Summon's name" aria-label="Summon's name"
                                        value={props.summonName} onChange={(e) => props.setSummonName(e.target.value)} />
                                    <select className={styles.select} value={props.summonOwner} aria-label="Summon's owner" onChange={(e) => props.setSummonOwner(e.target.value)}>
                                        <option className={styles.option} value="">Owner: the DM</option>
                                        {data?.placeable?.party.map((p) => <option className={styles.option} key={p.ownerId} value={p.ownerId}>Owner: {p.username}</option>)}
                                    </select>
                                </>
                            )}
                        </div>
                    )}
                    {selectedToken && (
                        <div className={styles.row}>
                            <button type="button" className={styles.tool} onClick={props.onRemove}>Remove {selectedToken.name}</button>
                        </div>
                    )}
                </>
            )}
            {props.children}
            <p className={message ? `${styles.status} ${styles.error}` : styles.status} role={message ? 'alert' : 'status'}>{status}</p>
        </div>
    );
}

const titled = (word: string) => word[0].toUpperCase() + word.slice(1);

// The DM's Scene controls. Each change goes to the server at once, and every screen at the table follows.
function SceneControls({ mode, look, onLook, onResetFog, onClearMap }: { mode: 'session' | 'editor'; look: SceneLook; onLook: (change: Partial<SceneLook>) => void; onResetFog: () => void; onClearMap: () => void }) {
    const editing = mode === 'editor';
    const [sure, setSure] = useState(false);
    const [url, setUrl] = useState(look.map?.url ?? '');
    const [size, setSize] = useState(look.map?.size ?? 30);
    return (
        <>
            <div className={styles.row}>
                <div className={styles.moodSelect}>
                    {SCENE_MOODS.map((m) => <button aria-pressed={look.mood === m} onClick={(e) => onLook({ mood: m })} key={m} type="button" className={styles.tool} value={m}>{titled(m)}</button>)}
                </div>
                <div className={styles.weatherSelect}>
                    {SCENE_WEATHERS.map((w) => <button aria-pressed={look.weather === w} onClick={(e) => onLook({ weather: w })} key={w} type="button" className={styles.tool} value={w}>{titled(w)}</button>)}
                </div>
                <div className={styles.roomSelect}>
                    <button aria-pressed={look.room ?? false} onClick={(e) => onLook({ room: !look.room })} key="room" type="button" className={styles.tool}> Room and candles</button>
                </div>
                {!editing && (
                        <button type="button" aria-pressed={look.fog ?? false} className={styles.tool} onClick={(e) => onLook({ fog: !look.fog })}> Fog</button>
                )}
                {!editing && look.fog && <button type="button" className={styles.tool} onClick={onResetFog}>Cover the map again</button>}
                {!editing ? null : sure ? (
                    <>
                        <button type="button" className={`${styles.tool} ${styles.toolDanger}`} onClick={() => { setSure(false); onClearMap(); }}>Yes, clear everything</button>
                        <button type="button" className={styles.tool} onClick={() => setSure(false)}>Keep it</button>
                    </>
                ) : <button type="button" className={styles.tool} onClick={() => setSure(true)}>Clear map</button>}
            </div>
            {editing && (
                <form className={styles.row} onSubmit={(e) => { e.preventDefault(); onLook({ map: { url: url.trim(), size } }); }}>
                    <input className={styles.input} type="url" placeholder="Map picture link (https://…)" aria-label="Map picture link"
                        value={url} onChange={(e) => setUrl(e.target.value)} />
                    <label className={styles.field}>Width{' '}
                        <input className={styles.inputRange} type="range" min={10} max={80} step={1} value={size} onChange={(e) => setSize(Number(e.target.value))} />
                    </label>
                    <button type="submit" className={styles.tool} disabled={!url.trim()}>Show map</button>
                    {look.map && <button type="button" className={styles.tool} onClick={() => { setUrl(''); onLook({ map: null }); }}>Remove map</button>}
                </form>
            )}
        </>
    );
}

// The hex under the mouse, and the footprints to it. Kept in its own small component on purpose: the mouse crosses
// hexes many times a second, and only this little piece needs to redraw when it does (not the whole board).
function HoverLayer({ heights, walls, walker, preview, onHexClick, brush, onStroke, measuring, labels }: {
    measuring: boolean;                        // the Measure tool: press, drag, see how far
    labels: RefObject<HTMLDivElement | null>;
    heights: Record<string, number>; walls: Set<string>; walker: Token | null;
    onHexClick: (hex: Hex, e: ThreeEvent<MouseEvent>) => void;
    brush: number | null;                      // painting: rings around the mouse (0 = one hex); null = not painting
    onStroke: (hexes: Hex[]) => void;          // a finished stroke (or a single click), sent to the server at once
    preview: { kind: AreaKind; sizeFt: number; from: Hex | null } | null;   // a shape to show under the mouse
}) {
    const [hover, setHover] = useState<Hex | null>(null);
    // ---- painting: press, drag across hexes (they're collected and shown), let go: one request for the whole stroke ----
    const stroke = useRef<Map<string, Hex> | null>(null);
    const lastHex = useRef<Hex | null>(null);   // where the stroke was at the last mouse move
    const [strokeHexes, setStrokeHexes] = useState<Hex[]>([]);
    const addToStroke = (h: Hex) => {
        if (!stroke.current || brush === null) return;
        // a fast drag jumps several hexes between two mouse moves: fill in the straight line between them
        const along = lastHex.current ? hexLine(lastHex.current, h) : [h];
        lastHex.current = h;
        let grew = false;
        for (const step of along) {
            for (const x of brushAround(step, brush)) {
                const k = hexKey(x);
                if (!stroke.current.has(k)) { stroke.current.set(k, x); grew = true; }
            }
        }
        if (grew) setStrokeHexes([...stroke.current.values()]);
    };
    const endStroke = () => {
        if (!stroke.current) return;
        const hexes = [...stroke.current.values()];
        stroke.current = null;
        setStrokeHexes([]);
        if (hexes.length) onStroke(hexes);
    };
    // ---- measuring: from where the mouse was pressed to where it is now (stays on show until the next press) ----
    const [measure, setMeasure] = useState<{ from: Hex; to: Hex } | null>(null);
    const measuringNow = useRef(false);
    useEffect(() => { if (!measuring) setMeasure(null); }, [measuring]);
    const footprint = useMemo(() => (brush !== null && hover ? brushAround(hover, brush) : []), [brush, hover?.q, hover?.r]);
    const path = useMemo(() => (walker && hover ? findPath(walker, hover, walls, 200) : null),
        [walker?.q, walker?.r, hover?.q, hover?.r, walls]);
    return (
        <>
            {/* an invisible sheet over the board that only notices which hex the mouse is over */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.1, 0]}
                onPointerMove={(e) => {
                    const h = worldToHex(e.point.x, e.point.z);
                    const inside = Math.max(Math.abs(h.q), Math.abs(h.r), Math.abs(h.q + h.r)) <= GRID_RADIUS;
                    setHover((old) => (!inside ? null : old && old.q === h.q && old.r === h.r ? old : h));
                    if (stroke.current && inside) addToStroke(hexUnder(e.ray, heights));
                    if (measuringNow.current && inside) {
                        const to = hexUnder(e.ray, heights);
                        setMeasure((m) => (m && (m.to.q !== to.q || m.to.r !== to.r) ? { ...m, to } : m));
                    }
                }}
                onPointerOut={() => setHover(null)}
                onPointerDown={(e) => {
                    if (measuring && e.button === 0) {
                        (e.target as Element).setPointerCapture?.(e.pointerId);
                        const at = hexUnder(e.ray, heights);
                        measuringNow.current = true;
                        setMeasure({ from: at, to: at });
                        return;
                    }
                    if (brush === null || e.button !== 0) return;        // only the left button paints
                    (e.target as Element).setPointerCapture?.(e.pointerId); // keep the stroke even if the mouse leaves the board
                    stroke.current = new Map();
                    lastHex.current = null;
                    addToStroke(hexUnder(e.ray, heights));
                }}
                onPointerUp={() => { measuringNow.current = false; endStroke(); }}
                onPointerCancel={() => { measuringNow.current = false; endStroke(); }}
                onClick={(e) => {
                    if (brush !== null || measuring) return;             // painting / measuring: handled by press and drag
                    // Which hex was clicked: one answer per click, from where the mouse's line meets the board.
                    // (Before, every tile listened for itself, and a click could reach dozens of them at once.)
                    const hex = hexUnder(e.ray, heights);
                    if (Math.max(Math.abs(hex.q), Math.abs(hex.r), Math.abs(hex.q + hex.r)) <= GRID_RADIUS) onHexClick(hex, e);
                }}>
                <planeGeometry args={[RIM_OUTER * 2 + 10, RIM_OUTER * 2 + 10]} />
                <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
            <HoverGlow hex={hover} heights={heights} />
            {/* painting: the brush under the mouse, and the stroke so far */}
            {brush !== null && <HexPatches hexes={footprint} color="#ffe08a" opacity={0.22} heights={heights} y={0.113} />}
            {strokeHexes.length > 0 && <HexPatches hexes={strokeHexes} color="#ffd060" opacity={0.42} heights={heights} y={0.114} />}
            <PathPreview path={path} heights={heights} />
            {measure && <MeasureLine from={measure.from} to={measure.to} heights={heights} labels={labels} />}
            <AreaPreview area={preview && hover ? { kind: preview.kind, at: hover, sizeFt: preview.sizeFt } : null}
                from={preview?.from ? { q: preview.from.q, r: preview.from.r } : null} heights={heights} />
        </>
    );
}

// ?perf only: notes slow frames, and every time the graphics card has to build new shaders (the little programs that
// draw each material). Building shaders stalls a frame, and is the usual cause of a sudden flash in a 3D page.
function FrameWatch() {
    const programs = useRef(-1);
    useFrame(({ gl }, delta) => {
        const count = gl.info.programs?.length ?? 0;
        if (programs.current >= 0 && count !== programs.current) debugLog(`shaders: ${programs.current} → ${count}`);
        programs.current = count;
        if (delta > 0.1) debugLog(`slow frame: ${Math.round(delta * 1000)} ms`);
    });
    useEffect(() => {
        const lost = () => debugLog('graphics: DRAWING SURFACE LOST');
        const back = () => debugLog('graphics: drawing surface restored');
        const canvas = document.querySelector('canvas');
        canvas?.addEventListener('webglcontextlost', lost);
        canvas?.addEventListener('webglcontextrestored', back);
        const hidden = () => debugLog('page', document.visibilityState);
        document.addEventListener('visibilitychange', hidden);
        return () => {
            canvas?.removeEventListener('webglcontextlost', lost);
            canvas?.removeEventListener('webglcontextrestored', back);
            document.removeEventListener('visibilitychange', hidden);
        };
    }, []);
    return null;
}

// A token on the board, redrawn only when that token (or whether it's selected) changes
const TokenOnBoard = memo(function TokenOnBoard({ onPick, ...piece }: Omit<Parameters<typeof TokenPiece>[0], 'onClick'> & {
    onPick: (token: Token, e: ThreeEvent<MouseEvent>) => void;
}) {
    const onClick = useCallback((e: ThreeEvent<MouseEvent>) => onPick(piece.token, e), [onPick, piece.token]);
    return <TokenPiece {...piece} onClick={onClick} />;
});

const NO_OVERLAYS: Overlay[] = [];

// ---- Step 17: the Act menu, shapes, the feed ----

// What floats over a token after an action that didn't change its HP (a miss, a save). Hits show through the HP.
type Notice = { id: string; text: string };
function noticesFrom(entry: FeedEntry | null): Map<number, Notice> {
    const out = new Map<number, Notice>();
    for (const o of entry?.outcomes ?? []) {
        if (o.result === 'miss') out.set(o.tokenId, { id: `${entry!.id}-${o.tokenId}`, text: 'Miss' });
        if (o.result === 'saved') out.set(o.tokenId, { id: `${entry!.id}-${o.tokenId}`, text: 'Saved' });
    }
    return out;
}

// The selected token's actions: pick one, then (for spells) the level and a target or an area
function ActPanel({ token, acting, setActing }: { token: Token; acting: Acting | null; setActing: (a: Acting | null) => void }) {
    const { data, error } = useTokenActions(token.id);
    if (error) return <p className={styles.status}>{messageOf(error)}</p>;
    if (!data) return null;
    const pick = (c: ActChoice) => setActing(acting?.choice.key === c.key ? null
        : { choice: c, castLevel: c.baseLevel, mode: 'target', kind: 'circle', sizeFt: 10, keepTurns: 0 });
    const left = (level: number) => (data.slots[level - 1] ?? 0) - Number(data.usedSlots[level] ?? 0);
    const levels = acting?.choice.kind === 'spell' && acting.choice.baseLevel
        ? Array.from({ length: 10 - acting.choice.baseLevel }, (_, i) => acting.choice.baseLevel! + i).filter((l) => (data.slots[l - 1] ?? 0) > 0)
        : [];
    return (
        <>
            <div className={styles.row}>
                <span className={styles.field}>Act:</span>
                {data.choices.map((c) => (
                    <button  key={c.key} type="button" title={`${c.detail} · ${c.rangeFt ? `${c.rangeFt} ft` : 'self'}`}
                        aria-pressed={acting?.choice.key === c.key}
                        className={acting?.choice.key === c.key ? `${styles.tool} ${styles.toolOn}` : styles.tool}
                        onClick={() => pick(c)}>{c.name}</button>
                ))}
                {data.choices.length === 0 && <span className={styles.field}>Nothing to act with</span>}
            </div>
            {acting && acting.choice.kind === 'spell' && (
                <div className={styles.row}>
                    {levels.length > 0 && (
                        <label className={styles.field}>Level{' '}
                            <select className={styles.select} value={acting.castLevel ?? ''} onChange={(e) => setActing({ ...acting, castLevel: Number(e.target.value) })}>
                                {levels.map((l) => <option className={styles.option} key={l} value={l}>{l} ({left(l)} left)</option>)}
                            </select>
                        </label>
                    )}
                    {(['target', 'area'] as const).map((m) => (
                        <button key={m} type="button" aria-pressed={acting.mode === m}
                            className={acting.mode === m ? `${styles.tool} ${styles.toolOn}` : styles.tool}
                            onClick={() => setActing({ ...acting, mode: m })}>{m === 'target' ? 'One target' : 'Area'}</button>
                    ))}
                    {acting.mode === 'area' && (
                        <>
                            {AREA_KINDS.map((k) => (
                                <button key={k} type="button" aria-pressed={acting.kind === k}
                                    className={acting.kind === k ? `${styles.tool} ${styles.toolOn}` : styles.tool}
                                    onClick={() => setActing({ ...acting, kind: k })}>{titled(k)}</button>
                            ))}
                            <label className={styles.field}>{SIZE_WORD[acting.kind]}{' '}
                                <select className={styles.select} value={acting.sizeFt} onChange={(e) => setActing({ ...acting, sizeFt: Number(e.target.value) })}>
                                    {SIZES_FT.map((f) => <option className={styles.option} key={f} value={f}>{f} ft</option>)}
                                </select>
                            </label>
                            <label className={styles.field}>Stays{' '}
                                <input className={styles.input} type="number" min={0} max={100} value={acting.keepTurns} 
                                    onChange={(e) => setActing({ ...acting, keepTurns: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })} /> turns
                            </label>
                        </>
                    )}
                </div>
            )}
        </>
    );
}

// The Shapes tool: which shape, how big, how long it stays, and its name
function ShapeControls({ tool, setTool }: { tool: Extract<Tool, { type: 'shape' }>; setTool: (t: Tool) => void }) {
    return (
        <div className={styles.row}>
            {AREA_KINDS.map((k) => (
                <button key={k} type="button" aria-pressed={tool.kind === k}
                    className={tool.kind === k ? `${styles.tool} ${styles.toolOn}` : styles.tool}
                    onClick={() => setTool({ ...tool, kind: k })}>{titled(k)}</button>
            ))}
            <label className={styles.field}>{SIZE_WORD[tool.kind]}{' '}
                <select className={styles.select} value={tool.sizeFt} onChange={(e) => setTool({ ...tool, sizeFt: Number(e.target.value) })}>
                    {SIZES_FT.map((f) => <option className={styles.option} key={f} value={f}>{f} ft</option>)}
                </select>
            </label>
            <label className={styles.field}>Turns{' '}
                <input className={styles.input} type="number" min={0} max={100} value={tool.turns}  title="0 = stays until removed"
                    onChange={(e) => setTool({ ...tool, turns: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })} />
            </label>
            <input className={styles.input} type="text" maxLength={40} placeholder="Name (e.g. Fog Cloud)" aria-label="Shape name"
                value={tool.name} onChange={(e) => setTool({ ...tool, name: e.target.value })} />
        </div>
    );
}

// The shapes on the board, with Remove for your own (the DM can remove any)
function ShapeList({ overlays, userId, isDm, onRemove }: { overlays: Overlay[]; userId: number; isDm: boolean; onRemove: (id: number) => void }) {
    if (overlays.length === 0) return null;
    return (
        <div className={styles.row}>
            {overlays.map((o) => (
                <span key={o.id} className={styles.field}>
                    {o.name}{o.turnsLeft != null ? ` (${o.turnsLeft})` : ''}
                    {(isDm || o.ownerId === userId) && (
                        <button type="button" className={styles.tool} onClick={() => onRemove(o.id)} aria-label={`Remove ${o.name}`}>×</button>
                    )}
                </span>
            ))}
        </div>
    );
}

// The feed: the last few actions, newest on top
function Feed({ entries }: { entries: FeedEntry[] }) {
    if (entries.length === 0) return null;
    return (
        <ol className={styles.feed} aria-label="What just happened" aria-live="polite">
            {entries.slice(0, 4).map((e) => (
                <li key={e.id} className={styles.feedEntry}>
                    <span className={styles.feedTitle}>{e.title}</span>
                    {e.lines.map((line, i) => <span key={i} className={styles.feedLine}>{line}</span>)}
                </li>
            ))}
        </ol>
    );
}

// The hex under the mouse: where its line meets the board's surface. A raised hex's top is higher, so if the first
// answer is a raised hex, look again at that height (otherwise, with the camera tilted, clicks on hills land behind them).
function hexUnder(ray: { origin: { x: number; y: number; z: number }; direction: { x: number; y: number; z: number } }, heights: Record<string, number>): Hex {
    const at = (y: number) => {
        const t = (y - ray.origin.y) / ray.direction.y;
        return worldToHex(ray.origin.x + ray.direction.x * t, ray.origin.z + ray.direction.z * t);
    };
    const flat = at(0.1);
    const lift = liftOf(heights, flat);
    if (lift === 0) return flat;
    const high = at(0.1 + lift);
    return liftOf(heights, high) > 0 ? high : flat;
}

// ---- the map editor ----

// The tools that paint (click or drag): terrain, the eraser, ground, placed things, raised ground
const PAINT_TOOLS: Tool['type'][] = ['paint', 'erase', 'surface', 'feature', 'height'];
// brush sizes: [label, rings around the mouse]
const BRUSHES: [string, number][] = [['1 hex', 0], ['7', 1], ['19', 2]];

// The hexes a brush covers around one hex (only those on the board)
function brushAround(hex: Hex, rings: number): Hex[] {
    return hexesWithin(hex, rings).filter(onBoard);
}

// What the current tool paints, as the server's brush
function brushOf(tool: Tool): Brush | null {
    switch (tool.type) {
        case 'paint': return { terrain: tool.terrain };
        case 'erase': return { clear: true };
        case 'surface': return { surface: tool.surface };
        case 'feature': return { feature: tool.kind ? { kind: tool.kind, size: tool.size, ...(tool.kind === 'light' ? { color: tool.color } : {}) } : null };
        case 'height': return { height: tool.height };
        default: return null;
    }
}
