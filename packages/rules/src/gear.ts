// What a role can use, and which common gear the inventory tab may offer.
// Callings are not included. PLACEHOLDER until docs/DECISIONS.md: a calling does not add proficiencies.

const ARMOR_PROF_TO_TYPE: Record<string, string> = {
    'light armor': 'light',
    'medium armor': 'medium',
    'heavy armor': 'heavy',
    shields: 'shield',
    shield: 'shield',
};

function parts(text: string | null | undefined): string[] {
    return String(text ?? '')
        .split(',')
        .map((part) => part.trim())
        .filter((part) => part && part !== '-' && part.toLowerCase() !== 'none' && part.toLowerCase() !== 'null');
}

// "Light Armor, Shields" -> ["light", "shield"]
export function armorTypesFromProf(armorProf: string | null | undefined): string[] {
    const types = new Set<string>();
    for (const part of parts(armorProf)) {
        const type = ARMOR_PROF_TO_TYPE[part.toLowerCase()];
        if (type) types.add(type);
    }
    return [...types];
}

// "Minor, Reach" -> ["Minor", "Reach"]
export function weaponCategoryNamesFromProf(weaponProf: string | null | undefined): string[] {
    return parts(weaponProf);
}

export function toolNamesFromProf(toolProf: string | null | undefined): string[] {
    return parts(toolProf);
}

export type GearArmor = { id: number; name: string; armor_type: string; rarity?: string | null };
export type GearWeapon = { id: number; name: string; category_id: number; rarity?: string | null; is_unique?: boolean };
export type GearItem = { id: number; name: string; rarity?: string | null };
export type GearPack = {
    armor?: GearArmor[];
    weapons?: GearWeapon[];
    weapon_category?: { id: number; name: string }[];
    items?: GearItem[];
};
export type GearRole = { armor_prof?: string | null; weapon_prof?: string | null; tool_prof?: string | null } | null | undefined;

export type GearChoice = { id: number; name: string; proficient: boolean };

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);
const isCommon = (row: { rarity?: string | null }) => String(row.rarity ?? 'common').toLowerCase() === 'common';

// Common gear, each one marked proficient or not from the role alone.
export function gearChoices(pack: GearPack, role: GearRole) {
    const armorTypes = new Set(armorTypesFromProf(role?.armor_prof));
    const weaponNames = weaponCategoryNamesFromProf(role?.weapon_prof);
    const allowedCategories = new Set(
        (pack.weapon_category ?? [])
            .filter((cat) => weaponNames.some((name) => name.toLowerCase() === cat.name.toLowerCase()))
            .map((cat) => cat.id)
    );
    return {
        proficiencies: {
            armor: [...armorTypes],
            weapons: weaponNames,
            tools: toolNamesFromProf(role?.tool_prof),
        },
        armor: (pack.armor ?? []).filter(isCommon).map((armor) => ({
            id: armor.id,
            name: armor.name,
            proficient: armorTypes.has(String(armor.armor_type).toLowerCase()),
        })).sort(byName),
        weapons: (pack.weapons ?? []).filter((weapon) => isCommon(weapon) && !weapon.is_unique).map((weapon) => ({
            id: weapon.id,
            name: weapon.name,
            proficient: allowedCategories.has(Number(weapon.category_id)),
        })).sort(byName),
        items: (pack.items ?? []).filter(isCommon).map((item) => ({ id: item.id, name: item.name })).sort(byName),
    };
}

// PLACEHOLDER until docs/DECISIONS.md: every new character starts with this much money.
export const STARTING_MONEY = 10;

// The first proficient weapon and the first proficient armor. Items stay empty.
export function defaultGear(choices: ReturnType<typeof gearChoices>): { error: string } | { weapon_id: number; armor_id: number | null } {
    const weapon = choices.weapons.find((item) => item.proficient);
    if (!weapon) return { error: 'This role has no starting weapon' };
    const armor = choices.armor.find((item) => item.proficient);
    return { weapon_id: weapon.id, armor_id: armor?.id ?? null };
}

type GearBody = Record<string, unknown> | null | undefined;

// The browser picks ids. Money is never taken from the browser.
export function checkGearTab(choices: ReturnType<typeof gearChoices>, body: GearBody): { error: string } | { weapon_id: number; armor_id: number | null; item_ids: number[]; money: number } {
    const weaponId = Number(body?.weapon_id);
    if (!choices.weapons.some((weapon) => weapon.id === weaponId)) return { error: 'Pick a weapon from the list' };

    const rawArmor = body?.armor_id;
    const armorId = rawArmor == null || rawArmor === '' ? null : Number(rawArmor);
    if (armorId != null && !choices.armor.some((armor) => armor.id === armorId)) return { error: 'Pick armor from the list' };

    const rawItems = body?.item_ids;
    const itemIds = Array.isArray(rawItems) ? rawItems.map(Number) : [];
    if (itemIds.some((id) => !choices.items.some((item) => item.id === id))) return { error: 'Pick items from the list' };
    if (new Set(itemIds).size !== itemIds.length) return { error: 'Each item can only be picked once' };

    return { weapon_id: weaponId, armor_id: armorId, item_ids: itemIds, money: STARTING_MONEY };
}
