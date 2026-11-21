// Server data for the new sheet. Blocks call these hooks; they never call fetch themselves.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api.ts';
import type { Creature } from '@tenebris/rules/creature';
import type { ActRequest } from '@tenebris/rules/actions';

export type SheetResponse = { creature: Creature; canEdit: boolean; access: 'owner' | 'dm' | 'viewer' };

const sheetKey = (id: string) => ['sheet', 'character', id];

export function useSheet(id: string) {
    return useQuery({ queryKey: sheetKey(id), queryFn: () => api<SheetResponse>(`/api/sheets/character/${id}`) });
}

// Ask the server to resolve one action. It answers the roll-feed text.
export function useAct(id: string) {
    return useMutation({
        mutationFn: (request: ActRequest) => api<{ text: string }>(`/api/sheets/character/${id}/act`, { method: 'POST', body: request }),
    });
}

// HP, temp HP and per-rest state go through the existing endpoints, then the sheet reloads
export function useSheetChange(id: string) {
    const queryClient = useQueryClient();
    const refresh = () => queryClient.invalidateQueries({ queryKey: sheetKey(id) });
    return {
        hp: useMutation({
            mutationFn: (body: { action: 'heal' | 'damage'; amount: number }) => api(`/api/characters/${id}/hp`, { method: 'PATCH', body }),
            onSuccess: refresh,
        }),
        tempHp: useMutation({
            mutationFn: (amount: number) => api(`/api/characters/${id}/temp-hp`, { method: 'PATCH', body: { amount } }),
            onSuccess: refresh,
        }),
        state: useMutation({
            mutationFn: (patch: Record<string, unknown>) => api(`/api/characters/${id}/state`, { method: 'PATCH', body: patch }),
            onSuccess: refresh,
        }),
    };
}
