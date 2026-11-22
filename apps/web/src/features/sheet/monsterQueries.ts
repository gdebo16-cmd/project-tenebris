// Server data for the monster sheet (R5.6). Same idea as queries.ts: blocks call hooks, never fetch.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api.ts';
import type { Creature } from '@tenebris/rules/creature';
import type { ActRequest } from '@tenebris/rules/actions';
import type { MonsterGlimpse } from '@tenebris/rules/monster';

// The DM gets the whole Creature; other members of the campaign get a glimpse
export type MonsterSheetResponse =
    | { creature: Creature; canEdit: true; access: 'dm' }
    | { glimpse: MonsterGlimpse; canEdit: false; access: 'viewer' };

export const monsterKey = (id: string | number) => ['sheet', 'monster', String(id)];

export function useMonsterSheet(id: string) {
    return useQuery({ queryKey: monsterKey(id), queryFn: () => api<MonsterSheetResponse>(`/api/sheets/monster/${id}`) });
}

// Ask the server to roll one of the monster's actions or checks. It answers the roll-feed text.
export function useMonsterAct(id: string) {
    return useMutation({
        mutationFn: (request: ActRequest) => api<{ text: string }>(`/api/sheets/monster/${id}/act`, { method: 'POST', body: request }),
    });
}

// HP, ward, conditions and notes (DM). The sheet reloads after each one.
export function useMonsterChange(id: string) {
    const queryClient = useQueryClient();
    const refresh = () => queryClient.invalidateQueries({ queryKey: monsterKey(id) });
    return {
        hp: useMutation({
            mutationFn: (body: { action: 'heal' | 'damage'; amount: number }) => api(`/api/sheets/monster/${id}/hp`, { method: 'POST', body }),
            onSuccess: refresh,
        }),
        tempHp: useMutation({
            mutationFn: (amount: number) => api(`/api/sheets/monster/${id}/temp-hp`, { method: 'POST', body: { amount } }),
            onSuccess: refresh,
        }),
        conditions: useMutation({
            mutationFn: (body: { conditions?: Record<string, boolean>; exhaustion?: number }) =>
                api(`/api/sheets/monster/${id}/conditions`, { method: 'POST', body }),
            onSuccess: refresh,
        }),
        notes: useMutation({
            mutationFn: (notes: string) => api(`/api/sheets/monster/${id}/notes`, { method: 'PUT', body: { notes } }),
            onSuccess: refresh,
        }),
    };
}
