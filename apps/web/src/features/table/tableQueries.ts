// Server data for the table (steps 12–13). Every change answers with the new state, which goes straight into the
// stored scene (setQueryData): one trip per click instead of two.
import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Feature, SceneLook, Hex } from '@tenebris/rules/hex';
import type { Area } from '@tenebris/rules/sight';
import type { ActChoice } from '@tenebris/rules/combat';
import { api } from '../../api.ts';
import socket from '../../utils/socket.js';
import { debugLog } from './tableDebug.ts';

export type Scene = {
    id: number;
    name: string;
    terrain: Record<string, string>;     // the rules: { "q,r": "wall" }
    surfaces: Record<string, string>;    // the looks: { "q,r": "cobble" } (unlisted hexes = DEFAULT_SURFACE)
    features: Record<string, Feature>;   // placed things: { "q,r": { kind: 'tree', size: 1 } }
    look: SceneLook;                     // mood, weather, room, map picture, heights
}

// The turn order the table shows (everyone sees it): whose turn, which round
export type Turns = { round: number; turn: number; order: { kind: 'character' | 'monster'; id: number; name: string }[] };

export type Token = {
    id: number;
    kind: 'character' | 'monster' | 'summon';
    q: number;
    r: number;
    ownerId: number | null;     // null = the DM's
    name: string;
    portrait: string | null;
    characterId: number | null;  // which creature: to match the turn order
    monsterId: number | null;
    hp: { current: number; max: number; temp: number } | null;   // characters only
    health: string | null;      // 'Unhurt' | 'Wounded' | 'Bloodied' | 'Near death' | 'Down' (monsters show only this)
    conditions: string[];
}

// What the DM can put on the table (only sent to the DM)
export type Placeable = {
    party: { characterId: number; name: string; ownerId: number; username: string }[];
    monsters: { id: number; name: string }[];
}

// A shape on the board: a spell area left behind, or one someone drew (step 17, spec: Overlays)
export type Overlay = { id: number; name: string; ownerId: number | null; area: Area; from: Hex | null; turnsLeft: number | null; countsTokenId: number | null };

// The fog (step 18): hexes the party sees now, and every hex it has seen. null = the fog is off.
export type Fog = { visible: string[]; explored: string[] };

// One entry in the table's feed: what an action did (step 17)
export type FeedEntry = {
    id: string; at: number; title: string; lines: string[];
    area: string[] | null;                     // hex keys the action covered (flashes on the board)
    outcomes: { tokenId: number; result: 'hit' | 'miss' | 'saved' | 'failed' | 'damage' | 'heal'; damage: number; heal: number }[];
    actorTokenId: number | null;
};

export type SceneData = {
    scene: Scene | null;
    isDm: boolean;
    userId: number;              // who's asking: their tokens are the ones they can move
    tokens: Token[];
    overlays: Overlay[];
    fog: Fog | null;
    placeable?: Placeable;
    turns: Turns | null;           // null = no fight going on
}

// What token.place sends
export type PlaceRequest =
    | { kind: 'character'; characterId: number }
    | { kind: 'monster'; campaignMonsterId: number }
    | { kind: 'summon'; name: string; ownerId: number | null };

// Which board a page shows: "41" = campaign 41's live board (play session); "41@7" = board 7 in the map editor.
// Every hook below takes this "board" string, so the editor and the session keep separate copies of what they show.
export const campOf = (board: string) => board.split('@')[0];
export const editOf = (board: string) => (board.includes('@') ? Number(board.split('@')[1]) : null);
export const sceneKey = (board: string) => ['campaign', board, 'scene'];

export function useScene(board: string) {
    const editId = editOf(board);
    return useQuery({
        queryKey: sceneKey(board),
        queryFn: () => {
            debugLog('loading the scene from the server');
            return api<SceneData>(editId ? `/api/scenes/${editId}/edit` : `/api/campaigns/${campOf(board)}/scene`);
        },
        refetchOnWindowFocus: false,       // the socket keeps it up to date; reloading on focus redrew the whole board
    });
}

export type Brush = { terrain: string | null } | { surface: string | null } | { feature: Feature | null } | { height: number } | { clear: true };

export function usePaint(campId: string) {
    const queryClient = useQueryClient();
    return useMutation({
        // a stroke of hexes and one brush: { terrain } (the rules), { surface } (the look), { feature }, { height },
        // or { clear: true } (the eraser: everything goes). null erases that one brush.
        mutationFn: ({ sceneId, hexes, ...brush }: { sceneId: number; hexes: { q: number; r: number }[] } & Brush) =>
            api<Pick<Scene, 'terrain' | 'surfaces' | 'features' | 'look'>>(`/api/scenes/${sceneId}/paint`, { method: 'POST', body: { hexes, ...brush } }),
        onSuccess: ({ terrain, surfaces, features, look }) => {
            queryClient.setQueryData<SceneData>(sceneKey(campId), (old) =>
                old?.scene ? { ...old, scene: { ...old.scene, terrain, surfaces, features, look } } : old,
            );
        },
    });
}

// Placing, moving and removing tokens all answer with the whole scene, which replaces the stored one
function useTokenChange<Vars>(campId: string, send: (vars: Vars) => Promise<SceneData>) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: send,
        onSuccess: (answer) => queryClient.setQueryData<SceneData>(sceneKey(campId), answer),
    });
}

export function usePlaceToken(campId: string) {
    return useTokenChange(campId, ({ sceneId, q, r, place }: { sceneId: number; q: number; r: number; place: PlaceRequest }) =>
        api<SceneData>(`/api/scenes/${sceneId}/tokens`, { method: 'POST', body: { ...place, q, r } }));
}

export function useMoveToken(campId: string) {
    return useTokenChange(campId, ({ tokenId, q, r }: { tokenId: number; q: number; r: number }) =>
        api<SceneData>(`/api/tokens/${tokenId}/move`, { method: 'POST', body: { q, r } }));
}

export function useRemoveToken(campId: string) {
    return useTokenChange(campId, (tokenId: number) =>
        api<SceneData>(`/api/tokens/${tokenId}`, { method: 'DELETE' }));
}

// Step 14: live updates. Joins the campaign's room; when anyone paints or moves something, the server sends the new
// terrain and tokens ('table'), which go straight into the stored scene. This page's own isDm / userId / placeable
// stay as they are (they're about who's looking, not what's on the board).
type TableUpdate = { sceneId: number; terrain: Record<string, string>; surfaces: Record<string, string>; features: Record<string, Feature>; look: SceneLook; tokens: Token[]; overlays: Overlay[]; fog: Fog | null };

export function useTableSync(campId: string) {
    const queryClient = useQueryClient();
    useEffect(() => {
        if (!campId) return;
        const join = () => socket.emit('join-campaign', campOf(campId));
        const onTable = (update: TableUpdate) => {
            debugLog("socket: 'table' news (someone painted or moved)");
            queryClient.setQueryData<SceneData>(sceneKey(campId), (old) =>
                old?.scene && old.scene.id === update.sceneId
                    ? { ...old, scene: { ...old.scene, terrain: update.terrain, surfaces: update.surfaces, features: update.features, look: update.look },
                        tokens: update.tokens, overlays: update.overlays, fog: update.fog }
                    : old,
            );
        };
        // the DM opened the table for the first time: anyone waiting loads it
        const onOpened = () => queryClient.invalidateQueries({ queryKey: sceneKey(campId) });
        // the DM switched the table to another board: the session loads it (the editor keeps the board it's on)
        const onSwitch = () => {
            queryClient.invalidateQueries({ queryKey: boardsKey(campOf(campId)) });
            if (!editOf(campId)) queryClient.invalidateQueries({ queryKey: sceneKey(campId) });
        };
        socket.on('table-switch', onSwitch);

        socket.connect();
        if (socket.connected) join();
        socket.on('connect', join);              // also after a dropped connection comes back
        socket.on('table', onTable);
        const onTurns = ({ turns }: { turns: Turns | null }) =>
            queryClient.setQueryData<SceneData>(sceneKey(campId), (old) => (old ? { ...old, turns } : old));
        socket.on('turns', onTurns);
        // ?perf: note every time the connection drops or comes back
        const onConnect = () => debugLog('socket: connected');
        const onDisconnect = (reason: string) => debugLog('socket: disconnected:', reason);
        const onConnectError = (err: Error) => debugLog('socket: could not connect:', err.message);
        socket.on('connect', onConnect);
        socket.on('disconnect', onDisconnect);
        socket.on('connect_error', onConnectError);
        socket.on('table-opened', onOpened);
        // step 17: what actions did, for the feed and the effects on the board
        const onFeed = (entry: FeedEntry) => addToFeed(queryClient, campId, entry);
        socket.on('table-feed', onFeed);
        return () => {
            socket.off('table-feed', onFeed);
            socket.off('table-switch', onSwitch);
            socket.off('connect', join);
            socket.off('table', onTable);
            socket.off('turns', onTurns);
            socket.off('connect', onConnect);
            socket.off('disconnect', onDisconnect);
            socket.off('connect_error', onConnectError);
            socket.off('table-opened', onOpened);
            socket.disconnect();
        };
    }, [campId, queryClient]);
}

// The DM changes the scene's mood, weather, room or map picture
export function useSetLook(campId: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ sceneId, ...change }: { sceneId: number } & Partial<SceneLook>) =>
            api<SceneLook>(`/api/scenes/${sceneId}/look`, { method: 'PUT', body: change }),
        onSuccess: (look) => queryClient.setQueryData<SceneData>(sceneKey(campId), (old) =>
            old?.scene ? { ...old, scene: { ...old.scene, look } } : old),
    });
}

// ---- Step 17: acting on the table ----

// The feed: the last few things that happened, newest first. Kept in the query cache so any component can read it.
export const feedKey = (campId: string) => ['campaign', campId, 'table-feed'];
const FEED_LENGTH = 8;

function addToFeed(queryClient: ReturnType<typeof useQueryClient>, campId: string, entry: FeedEntry) {
    queryClient.setQueryData<FeedEntry[]>(feedKey(campId), (old = []) =>
        old.some((e) => e.id === entry.id) ? old : [entry, ...old].slice(0, FEED_LENGTH));
}

export function useTableFeed(campId: string) {
    return useQuery({ queryKey: feedKey(campId), queryFn: () => [] as FeedEntry[], initialData: [] as FeedEntry[], staleTime: Infinity });
}

// What a token can do: its weapons and spells, with how far each reaches (only its owner or the DM may ask)
export type TokenActions = { tokenId: number; name: string; choices: ActChoice[]; slots: number[]; usedSlots: Record<string, number> };

export function useTokenActions(tokenId: number | null) {
    return useQuery({
        queryKey: ['token-actions', tokenId],
        queryFn: () => api<TokenActions>(`/api/tokens/${tokenId}/actions`),
        enabled: tokenId != null,
        staleTime: 10_000,
    });
}

export type ActRequest = { tokenId: number; actionKey: string; castLevel?: number; target?: number; area?: Area; keepTurns?: number };

export function useTableAct(campId: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ tokenId, ...body }: ActRequest) => api<FeedEntry>(`/api/tokens/${tokenId}/act`, { method: 'POST', body }),
        onSuccess: (entry, { tokenId }) => {
            addToFeed(queryClient, campId, entry);
            queryClient.invalidateQueries({ queryKey: ['token-actions', tokenId] });     // spell slots changed
        },
    });
}

// Shapes on the board (overlay.add / overlay.remove). The board updates from the 'table' news.
export function useAddOverlay() {
    return useMutation({
        mutationFn: ({ sceneId, ...body }: { sceneId: number; name?: string; area: Area; from?: Hex; turns?: number | null; countsTokenId?: number | null }) =>
            api<unknown>(`/api/scenes/${sceneId}/overlays`, { method: 'POST', body }),
    });
}

export function useRemoveOverlay() {
    return useMutation({ mutationFn: (overlayId: number) => api<unknown>(`/api/overlays/${overlayId}`, { method: 'DELETE' }) });
}

// Step 18: the DM hides the whole map again
export function useResetFog() {
    return useMutation({ mutationFn: (sceneId: number) => api<unknown>(`/api/scenes/${sceneId}/fog/reset`, { method: 'POST' }) });
}

// Clear map: the DM starts the map over (tokens stay). Answers like paint.
export function useClearMap(campId: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (sceneId: number) => api<Pick<Scene, 'terrain' | 'surfaces' | 'features' | 'look'>>(`/api/scenes/${sceneId}/clear`, { method: 'POST' }),
        onSuccess: ({ terrain, surfaces, features, look }) => queryClient.setQueryData<SceneData>(sceneKey(campId), (old) =>
            old?.scene ? { ...old, scene: { ...old.scene, terrain, surfaces, features, look } } : old),
    });
}

// ---- The board library (map editor) and the live board (play session) ----

export type BoardInfo = { id: number; name: string; isActive: boolean; tokenCount: number };
export const boardsKey = (campId: string) => ['campaign', campId, 'boards'];

export function useBoards(campId: string) {
    return useQuery({ queryKey: boardsKey(campId), queryFn: () => api<{ scenes: BoardInfo[] }>(`/api/campaigns/${campId}/scenes`) });
}

function useBoardChange<Vars, Answer>(campId: string, send: (vars: Vars) => Promise<Answer>) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: send,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: boardsKey(campId) });
            queryClient.invalidateQueries({ queryKey: sceneKey(campId) });     // the live board may have changed
        },
    });
}

// A new board (copyFrom: start from another board's map)
export const useCreateBoard = (campId: string) => useBoardChange(campId, (v: { name: string; copyFrom?: number }) =>
    api<{ id: number; name: string }>(`/api/campaigns/${campId}/scenes`, { method: 'POST', body: v }));
export const useRenameBoard = (campId: string) => useBoardChange(campId, ({ id, name }: { id: number; name: string }) =>
    api<unknown>(`/api/scenes/${id}`, { method: 'PATCH', body: { name } }));
export const useDeleteBoard = (campId: string) => useBoardChange(campId, (id: number) =>
    api<unknown>(`/api/scenes/${id}`, { method: 'DELETE' }));
// The DM puts a board on the table: everyone's session switches to it
export const useSetLiveBoard = (campId: string) => useBoardChange(campId, (sceneId: number) =>
    api<unknown>(`/api/campaigns/${campId}/active-scene`, { method: 'PUT', body: { sceneId } }));
