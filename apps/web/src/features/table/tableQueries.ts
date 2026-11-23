// Server data for the table (steps 12–13). Every change answers with the new state, which goes straight into the
// stored scene (setQueryData): one trip per click instead of two.
import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api.ts';
import socket from '../../utils/socket.js';

export type Scene = {
    id: number;
    name: string;
    terrain: Record<string, string>;
}

export type Token = {
    id: number;
    kind: 'character' | 'monster' | 'summon';
    q: number;
    r: number;
    ownerId: number | null;     // null = the DM's
    name: string;
    portrait: string | null;
    hp: { current: number; max: number; temp: number } | null;   // characters only
    health: string | null;      // 'Unhurt' | 'Wounded' | 'Bloodied' | 'Near death' | 'Down' (monsters show only this)
    conditions: string[];
}

// What the DM can put on the table (only sent to the DM)
export type Placeable = {
    party: { characterId: number; name: string; ownerId: number; username: string }[];
    monsters: { id: number; name: string }[];
}

export type SceneData = {
    scene: Scene | null;
    isDm: boolean;
    userId: number;              // who's asking: their tokens are the ones they can move
    tokens: Token[];
    placeable?: Placeable;
}

// What token.place sends
export type PlaceRequest =
    | { kind: 'character'; characterId: number }
    | { kind: 'monster'; campaignMonsterId: number }
    | { kind: 'summon'; name: string; ownerId: number | null };

export const sceneKey = (campId: string) => ['campaign', campId, 'scene'];

export function useScene(campId: string) {
    return useQuery({
        queryKey: sceneKey(campId),
        queryFn: () => api<SceneData>(`/api/campaigns/${campId}/scene`),
    });
}

export function usePaint(campId: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ sceneId, q, r, terrain }: { sceneId: number; q: number; r: number; terrain: string | null }) =>
            api(`/api/scenes/${sceneId}/paint`, { method: 'POST', body: { q, r, terrain } }),
        onSuccess: (newTerrain) => {
            queryClient.setQueryData<SceneData>(sceneKey(campId), (old) =>
                old?.scene ? { ...old, scene: { ...old.scene, terrain: newTerrain as Record<string, string> } } : old,
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
type TableUpdate = { sceneId: number; terrain: Record<string, string>; tokens: Token[] };

export function useTableSync(campId: string) {
    const queryClient = useQueryClient();
    useEffect(() => {
        if (!campId) return;
        const join = () => socket.emit('join-campaign', campId);
        const onTable = (update: TableUpdate) => {
            queryClient.setQueryData<SceneData>(sceneKey(campId), (old) =>
                old?.scene && old.scene.id === update.sceneId
                    ? { ...old, scene: { ...old.scene, terrain: update.terrain }, tokens: update.tokens }
                    : old,
            );
        };
        // the DM opened the table for the first time: anyone waiting loads it
        const onOpened = () => queryClient.invalidateQueries({ queryKey: sceneKey(campId) });

        socket.connect();
        if (socket.connected) join();
        socket.on('connect', join);              // also after a dropped connection comes back
        socket.on('table', onTable);
        socket.on('table-opened', onOpened);
        return () => {
            socket.off('connect', join);
            socket.off('table', onTable);
            socket.off('table-opened', onOpened);
            socket.disconnect();
        };
    }, [campId, queryClient]);
}
