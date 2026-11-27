import { useMemo, useState, useRef, useEffect, useCallback } from 'react'
import { hexesWithin, radiusOf, wallsOf, type SceneLook, type Hex } from '@tenebris/rules/board'
import { useParams } from 'react-router'
import { useScene, usePaint, usePlaceToken, useMoveToken, useRemoveToken, useTableSync, useSetLook, useTableFeed, useTableAct, useAddOverlay, useRemoveOverlay, useResetFog, useClearMap, type Token, type PlaceRequest } from './tableQueries.ts'
import { type BoardView } from './BoardCamera.tsx'
import { moodOf } from './BoardWorld.tsx'
import { type Tool, type Acting, PAINT_TOOLS } from './tableTypes.ts'
import { useCssColor } from '../../hooks/useCssColor.ts'
import { gridLines, NO_OVERLAYS, brushOf, noticesFrom, messageOf, wasDrag, brushAround } from './tableUtils.ts'
import { tokenFor } from './TurnBar.tsx'
import { hexToWorld, liftOf } from './TableScenery.tsx'
import { type ThreeEvent } from '@react-three/fiber'
import { type Area } from '@tenebris/rules/sight'

// All the table's state, data and click handling in one place: TablePage.tsx, TablePanels.tsx and BoardCanvas.tsx read from it.
export function useTableController(mode: 'session' | 'editor', editSceneId: number | null) {
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
    const radius = radiusOf(look);                                  // this board's size (old boards: 12)
    const hexes = useMemo(() => hexesWithin({ q: 0, r: 0 }, radius), [radius]);   // the grid changes only with the board's size
    const heights = useMemo(() => look.heights ?? {}, [look.heights]);
    const mood = moodOf(look.mood);
    const setLook = useSetLook(board);
    // sharpness: fixed for the whole visit. (Changing it on the fly resized the drawing surface mid-game, which
    // flashed a black box over part of the screen.)
    const dpr = Math.min(2, window.devicePixelRatio);
    const showPerf = new URLSearchParams(window.location.search).has('perf');   // /table?perf shows a frame counter
    const noEffects = new URLSearchParams(window.location.search).has('nofx');
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
            paintHexes(brushAround(hex, brush, radius));      // a click on a wall or a placed tree (clicks on open ground come as strokes)
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
    // redraws every hex and rock.
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


    return {
        hexes, radius, campId, editing, data, error, terrain, move, remove, view, setView, fitKey, setFitKey, surfaces, features, walls, look, heights, mood, setLook, dpr, showPerf, noEffects, tool, setTool, selected, setSelected, placing, setPlacing, summonName, setSummonName, summonOwner, setSummonOwner, message, setMessage, boardRef, woodColor, surfaceColor, lines, isDm, tokens, overlays, fog, feed, removeOverlay, resetFog, acting, setActing, brush, setBrush, clearMap, painting, shapeOrigin, newest, notices, selectedToken, turns, currentAt, canMove, done, onHexClick, onStroke, onTokenClick, mode,
    };
}

export type TableController = ReturnType<typeof useTableController>;
