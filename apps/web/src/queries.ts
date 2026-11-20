// Every piece of server data the app reads, as one named hook each.
// Pages call these hooks instead of fetching:  const { data, isLoading, error } = useHome();
//
// Each hook has a KEY (like ['campaign', 5]). TanStack Query caches by key, so two pages
// asking for the same thing share one request. After a change (a save, a delete), call
// queryClient.invalidateQueries({ queryKey: [...] }) and every page showing it refreshes.

import { useQuery } from '@tanstack/react-query';
import { api, ApiError } from './api.ts';

// ---- Shapes the server sends back (only the fields the pages use) ----

export type Me = { id: number; username: string };
export type Profile = { site_theme?: string; site_background?: string; site_display?: string };
export type CharacterCard = { id: number; name: string; portrait_url?: string | null; race?: string; class?: string; subclass?: string };
export type CampaignCard = { id: number; name: string; description?: string | null; campaign_img_url?: string | null; role?: 'dm' | 'player' };
export type Draft = { id: number; name?: string; race?: string; class?: string; subclass?: string; class_id?: number | null };
export type HomeData = { username: string; characters: CharacterCard[]; campaigns: CampaignCard[]; draft: Draft | null };
export type Campaign = CampaignCard & { invite_code: string; character_id?: number | null; role: 'dm' | 'player' };
export type Member = { username: string; role: 'dm' | 'player'; character_id?: number | null; character_name?: string | null; portrait_url?: string | null };
export type CampaignData = { campaign: Campaign; members: Member[] };
export type CampaignMonster = { id: number; monster_id: number; name: string; nickname?: string | null; current_hp?: number };
export type MonsterSummary = { id: number; name: string };
export type Settings = { username: string; email: string };

// ---- Keys, in one place so a typo can't make two caches for one thing ----

export const keys = {
    me: ['me'] as const,
    profile: ['profile'] as const,
    home: ['home'] as const,
    campaigns: ['campaigns'] as const,
    campaign: (id: string | number) => ['campaign', String(id)] as const,
    campaignMonsters: (id: string | number) => ['campaign', String(id), 'monsters'] as const,
    monsterCatalog: ['monsterCatalog'] as const,
    settings: ['settings'] as const,
    content: ['content'] as const,
};

// ---- Hooks ----

// Who is logged in. A 401 means "nobody", so it isn't retried.
export const useMe = () =>
    useQuery({
        queryKey: keys.me,
        queryFn: () => api<Me>('/api/me'),
        retry: (count, err) => !(err instanceof ApiError && err.status === 401) && count < 1,
    });

export const useProfile = (enabled = true) =>
    useQuery({ queryKey: keys.profile, queryFn: () => api<Profile>('/api/profile'), enabled });

export const useHome = () => useQuery({ queryKey: keys.home, queryFn: () => api<HomeData>('/api/home') });

export const useCampaigns = () =>
    useQuery({ queryKey: keys.campaigns, queryFn: () => api<{ campaigns: CampaignCard[] }>('/api/campaigns') });

export const useCampaign = (id: string | number) =>
    useQuery({ queryKey: keys.campaign(id), queryFn: () => api<CampaignData>(`/api/campaigns/${id}`) });

// DM-only lists: pass enabled=false for players so nothing is requested.
export const useCampaignMonsters = (id: string | number, enabled: boolean) =>
    useQuery({ queryKey: keys.campaignMonsters(id), queryFn: () => api<CampaignMonster[]>(`/api/campaigns/${id}/monsters`), enabled });

export const useMonsterCatalog = (enabled: boolean) =>
    useQuery({ queryKey: keys.monsterCatalog, queryFn: () => api<MonsterSummary[]>('/api/monsters'), enabled });

export const useSettings = () => useQuery({ queryKey: keys.settings, queryFn: () => api<Settings>('/api/settings') });

// The game content pack (species, roles, items...). It rarely changes, so it never goes stale
// while the page is open. cache: 'no-cache' lets the browser reuse its copy when the server
// answers "unchanged" (304), so a reload costs a few hundred bytes, not the whole pack.
export const useContentPack = () =>
    useQuery({
        queryKey: keys.content,
        queryFn: () => api<Record<string, unknown>>('/api/content', { cache: 'no-cache' }),
        staleTime: Infinity,
    });
