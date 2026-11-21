// The shape GET /api/characters/:id/form returns. The server builds it in formView().
import type { Options } from '@tenebris/rules/characterForm';

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
    missing: string[];
    options: Options;
};

// Premade headshots in /portraits/headshots.json
export type Headshot = { file: string; label: string; group: string };

// What the header Save button sends
export type HeaderSave = { name: string; level: number; portrait_url: string | null };
