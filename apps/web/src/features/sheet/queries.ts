// Server data for the new sheet. Blocks call these hooks; they never call fetch themselves.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api.ts';
import type { Creature } from '@tenebris/rules/creature';
import type { ActRequest } from '@tenebris/rules/actions';
import type { RuneInfo } from '@tenebris/rules/equipment';

export type SheetResponse = { creature: Creature; canEdit: boolean; access: 'owner' | 'dm' | 'viewer' };

const sheetKey = (id: string) => ['sheet', 'character', id];

// enabled = false: no request (the DM page has no current player yet)
export function useSheet(id: string, enabled = true) {
    return useQuery({ queryKey: sheetKey(id), queryFn: () => api<SheetResponse>(`/api/sheets/character/${id}`), enabled });
}

// Ask the server to resolve one action. It answers the roll-feed text.
export function useAct(id: string) {
    return useMutation({
        mutationFn: (request: ActRequest) => api<{ text: string }>(`/api/sheets/character/${id}/act`, { method: 'POST', body: request }),
    });
}

// HP, temp HP, conditions and exhaustion go through the sheet's own routes (owner or DM). The sheet reloads after each one.
export type ConditionsChange = { conditions?: Record<string, boolean>; exhaustion?: number };

export function useSheetChange(id: string) {
    const queryClient = useQueryClient();
    const refresh = () => queryClient.invalidateQueries({ queryKey: sheetKey(id) });
    return {
        hp: useMutation({
            mutationFn: (body: { action: 'heal' | 'damage'; amount: number }) => api(`/api/sheets/character/${id}/hp`, { method: 'POST', body }),
            onSuccess: refresh,
        }),
        tempHp: useMutation({
            mutationFn: (amount: number) => api(`/api/sheets/character/${id}/temp-hp`, { method: 'POST', body: { amount } }),
            onSuccess: refresh,
        }),
        conditions: useMutation({
            mutationFn: (body: ConditionsChange) => api(`/api/sheets/character/${id}/conditions`, { method: 'POST', body }),
            onSuccess: refresh,
        }),
    };
}

// Changes the server decides and saves (R5): use a feature, take a rest, cast a spell (spends the slot).
// The browser names what it wants; the answer is the roll-feed text. The sheet reloads after each one.
export type SheetDo =
    | { path: 'feature'; body: { featureKey: string } }
    | { path: 'rest'; body: { type: 'short' | 'long' } }
    | { path: 'cast'; body: { actionKey: string; castLevel?: number } }
    | { path: 'rune'; body: { runeKey: string } };

export function useSheetDo(id: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ path, body }: SheetDo) => api<{ text: string }>(`/api/sheets/character/${id}/${path}`, { method: 'POST', body }),
        onSettled: () => queryClient.invalidateQueries({ queryKey: sheetKey(id) }),
    });
}

// ---- The spell book ----

export type BookSpell = {
    id: number; name: string; base_level: number;
    alignment_name?: string | null; element_name?: string | null; state_name?: string | null;
};
export type LearnedSpell = BookSpell & { is_prepared?: boolean; is_action?: boolean; is_racial?: boolean; is_bonus?: boolean };
export type SpellLimits = { cantrips: number; prepared: number; known: number; shared?: boolean } | null;
export type SpellbookResponse = { spells: BookSpell[]; learnedSpells: LearnedSpell[]; learnedIds: number[]; spellLimits?: SpellLimits };
export type SpellbookOp = 'learn' | 'unlearn' | 'prepare' | 'unprepare' | 'setAction' | 'removeAction';

const bookKey = (id: string) => ['sheet', 'character', id, 'spellbook'];

// Only loaded when the book is open
export function useSpellbook(id: string, open: boolean) {
    return useQuery({ queryKey: bookKey(id), queryFn: () => api<SpellbookResponse>(`/api/sheets/character/${id}/spellbook`), enabled: open });
}

// Learn, forget, prepare or mark as an action spell. The server checks the caps; the sheet and the book reload.
export function useSpellbookChange(id: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (body: { op: SpellbookOp; spellId: number }) => api(`/api/sheets/character/${id}/spellbook`, { method: 'POST', body }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: sheetKey(id) }),
    });
}

// ---- Money ----
// Add or spend coins. The server checks the amounts and the purse (no change-making) and answers the new totals.
export type MoneyBody = { action: 'add' | 'spend'; copper?: number; silver?: number; gold?: number; crowns?: number; oracles?: number };

export function useMoney(id: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (body: MoneyBody) => api<{ purse: Record<string, number> }>(`/api/sheets/character/${id}/money`, { method: 'POST', body }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: sheetKey(id) }),
    });
}

// The Gear tab: equip / unequip, weapon options (dual wield, two hands, Soul Brand, sigil mark) and runes.
// path is under /api/characters/:id, e.g. 'inventory/weapon/equip' or 'runes/inscribe' (owner or DM).
// After each change the sheet reloads, so Armor Class and the Actions tab follow.
const runesKey = (id: string) => ['sheet', 'character', id, 'runes'];
export type GearChange = { path: string; body: Record<string, unknown> };

export function useGear(id: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ path, body }: GearChange) => api<{ endedOldest?: string }>(`/api/characters/${id}/${path}`, { method: 'POST', body }),
        onSuccess: () => Promise.all([
            queryClient.invalidateQueries({ queryKey: sheetKey(id) }),
            queryClient.invalidateQueries({ queryKey: runesKey(id) }),
        ]),
    });
}

// The rune catalog and limits, loaded only for a Tome of Inscription Mage
export function useRuneInfo(id: string, enabled: boolean) {
    return useQuery({ queryKey: runesKey(id), queryFn: () => api<RuneInfo>(`/api/characters/${id}/runes`), enabled });
}
