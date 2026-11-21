// The shape GET /api/characters/:id/form returns. The server builds it in formView().
import type { Options } from '@tenebris/rules/characterForm';
import type { MoneyPresetKey, Purse } from '@tenebris/rules/money';

export type CharacterFormData = {
    id: number;
    is_draft: boolean;
    header: {
        name: string | null;
        level: number | null;
        portrait_url: string | null;
    };
    species: {
        species_id: number | null;
        subspecies_id: number | null;
        size_id: number | null;
        variant: string | null;
        eye_color: string | null;
        look_description: string | null;
    };
    role: {
        role_id: number | null;
        calling_id: number | null;
        skill_proficiencies: string[];
        feature_choices: Record<string, string[]>;
    };
    traits: {
        rolls: ({ rolls: number[]; dropped: number; total: number } | null)[];
        placement: Partial<Record<string, number>>;
        gifts: number[];
        plus2: string | null;
        plus1: string | null;
        scores: Record<string, number | null>;
    };
    personality: {
        alignment_code: string | null;
        upbringing_id: number | null;
        lifestyle_id: number | null;
        outlook_id: number | null;
        upbringing_state: string | null;
        lifestyle_state: string | null;
        outlook_state: string | null;
    };
    gear: {
        // Default money: the preset the coins match (null = none picked), the coins, and whether it can still be picked (drafts only)
        money_preset: MoneyPresetKey | null;
        purse: Purse;
        can_pick_money: boolean;
        weapon_id: number | null;
        armor_id: number | null;
        item_ids: number[];
        proficiencies: { armor: string[]; weapons: string[]; tools: string[] };
        weapons: { id: number; name: string; proficient: boolean }[];
        armor: { id: number; name: string; proficient: boolean }[];
        items: { id: number; name: string }[];
    };
    missing: string[];
    options: Options;
};

// Premade headshots in /portraits/headshots.json
export type Headshot = { file: string; label: string; group: string };

// What the header Save button sends
export type HeaderSave = { name: string; level: number; portrait_url: string | null };
