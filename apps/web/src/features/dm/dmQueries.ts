// Server data for the DM page (R5.7). HP changes use the sheets' own routes, which already allow the DM.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api.ts';
import type { InitiativeState, InitiativeOp } from '@tenebris/rules/initiative';
import type { HealthWord } from '@tenebris/rules/monster';

type Hp = { current: number; max: number; temp: number; band: number };
export type PartyMember = {
    id: number; name: string; username: string; portrait: string | null; role: string | null; level: number;
    hp: Hp; armor: number; initiative: number; health: HealthWord; conditions: string[];
};
export type EncounterMonster = {
    id: number; name: string; monsterName: string; portrait: string | null;
    hp: Hp; armor: number; initiative: number; health: HealthWord; conditions: string[];
};
export type DmPageData = {
    campaign: { id: number; name: string };
    party: PartyMember[];
    encounter: EncounterMonster[];
    initiative: InitiativeState | null;
    notes: string;
};
export type MonsterSummary = { id: number; name: string };

export const dmKey = (campId: string) => ['campaign', campId, 'dm'];

export function useDmPage(campId: string) {
    return useQuery({ queryKey: dmKey(campId), queryFn: () => api<DmPageData>(`/api/campaigns/${campId}/dm`) });
}

export function useMonsterCatalog() {
    return useQuery({ queryKey: ['monsterCatalog'], queryFn: () => api<MonsterSummary[]>('/api/monsters') });
}

// Everything the DM page changes; the page reloads after each one
export function useDmChange(campId: string) {
    const queryClient = useQueryClient();
    const refresh = () => queryClient.invalidateQueries({ queryKey: dmKey(campId) });
    return {
        hp: useMutation({
            mutationFn: ({ kind, id, action, amount }: { kind: 'character' | 'monster'; id: number; action: 'heal' | 'damage'; amount: number }) =>
                api(`/api/sheets/${kind}/${id}/hp`, { method: 'POST', body: { action, amount } }),
            // the lists, and the "current" sheet blocks showing that creature
            onSuccess: (_r, v) => Promise.all([refresh(), queryClient.invalidateQueries({ queryKey: ['sheet', v.kind, String(v.id)] })]),
        }),
        initiative: useMutation({
            mutationFn: (op: InitiativeOp) => api(`/api/campaigns/${campId}/initiative`, { method: 'POST', body: { op } }),
            onSuccess: refresh,
        }),
        notes: useMutation({
            mutationFn: (notes: string) => api(`/api/campaigns/${campId}/dm-notes`, { method: 'PUT', body: { notes } }),
            onSuccess: refresh,
        }),
        addMonster: useMutation({
            mutationFn: (body: { monster_id: number; nickname?: string }) => api(`/api/campaigns/${campId}/monsters`, { method: 'POST', body }),
            onSuccess: () => Promise.all([refresh(), queryClient.invalidateQueries({ queryKey: ['campaign', campId, 'monsters'] })]),
        }),
        removeMonster: useMutation({
            mutationFn: (id: number) => api(`/api/sheets/monster/${id}`, { method: 'DELETE' }),
            onSuccess: () => Promise.all([refresh(), queryClient.invalidateQueries({ queryKey: ['campaign', campId, 'monsters'] })]),
        }),
    };
}
