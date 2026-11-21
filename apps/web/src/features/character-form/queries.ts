// Server data for the character form. Components call these hooks; they never call fetch themselves.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api.ts';
import type { CharacterFormData, HeaderSave, Headshot } from './types.ts';
import type { Options } from '@tenebris/rules/characterForm';

// Picks that change which choices the server offers (level opens callings, a role opens its skills).
export type OptionPicks = {
    level: number;
    species_id?: number;
    role_id?: number;
    calling_id?: number;
};

export function useCharacterForm(id: string) {
    return useQuery({
        queryKey: ['character-form', id],
        queryFn: () => api<CharacterFormData>(`/api/characters/${id}/form`),
    });
}

// Same list the form's GET already includes. Used when the page has no saved character yet.
export function useCharacterOptions(picks: OptionPicks) {
    const params = new URLSearchParams({ level: String(picks.level) });
    if (picks.species_id != null) params.set('species_id', String(picks.species_id));
    if (picks.role_id != null) params.set('role_id', String(picks.role_id));
    if (picks.calling_id != null) params.set('calling_id', String(picks.calling_id));
    return useQuery({
        queryKey: ['character-options', picks],
        queryFn: () => api<Options>(`/api/character-options?${params}`),
    });
}

// Saves one tab, then reloads the form so the page shows what the server kept.
export function useSaveTab(id: string, tab: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (body: unknown) => api<CharacterFormData>(`/api/characters/${id}/form/${tab}`, { method: 'PUT', body }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['character-form', id] }),
    });
}

export function useCreateCharacter() {
    return useMutation({
        mutationFn: (body: HeaderSave) => api<{ id: number }>('/api/characters', { method: 'POST', body }),
    });
}

export function usePortraits() {
    return useQuery({
        queryKey: ['portraits'],
        queryFn: () => api<Headshot[]>('/portraits/headshots.json'),
        staleTime: Infinity,
    });
}
