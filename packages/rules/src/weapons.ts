// Weapon list helpers: the 8 categories and the rarity tiers in display order, and the category / rarity
// filter with a sort, used by the shop and the sheet's Gear tab (moved here from apps/web/src/utils/weapons.js).
export const WEAPON_CATEGORIES = [
    'Minor', 'Elegant One-Handed', 'Broad One-Handed', 'Ranged One-Handed',
    'Versatile', 'Reach', 'Great', 'Ranged Two-Handed',
] as const;
export const RARITIES = ['Common', 'Magical', 'Arcane', 'Mythical', 'Calamity'] as const;

export type WeaponSort = 'name' | 'category' | 'rarity';
// category / rarity: '' = all
export type WeaponFilter = { category: string; rarity: string; sort: WeaponSort };
export const EMPTY_WEAPON_FILTER: WeaponFilter = { category: '', rarity: '', sort: 'name' };

type Listed = { name: string; weapon_category?: string | null; rarity?: string | null };

const rank = (list: readonly string[], v: string | null | undefined) => { const i = list.indexOf(v ?? ''); return i < 0 ? list.length : i; };

// Keeps the weapons that match the category and rarity, sorted by name, category or rarity (then name).
// Returns a new list; the one passed in is not changed.
export function filterSortWeapons<W extends Listed>(weapons: readonly W[], { category = '', rarity = '', sort = 'name' }: Partial<WeaponFilter> = {}): W[] {
    const byName = (a: W, b: W) => a.name.localeCompare(b.name);
    const keyed: Record<WeaponSort, (a: W, b: W) => number> = {
        name: byName,
        category: (a, b) => rank(WEAPON_CATEGORIES, a.weapon_category) - rank(WEAPON_CATEGORIES, b.weapon_category) || byName(a, b),
        rarity: (a, b) => rank(RARITIES, a.rarity) - rank(RARITIES, b.rarity) || byName(a, b),
    };
    return weapons
        .filter((w) => (!category || w.weapon_category === category) && (!rarity || w.rarity === rarity))
        .sort(keyed[sort] ?? byName);
}
