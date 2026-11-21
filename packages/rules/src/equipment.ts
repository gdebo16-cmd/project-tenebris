// Equipping and runes on the sheet's Gear tab (ported from the old sheet's Inventory tab, weapon options and rune control).
// The server checks each request with these functions and the models enforce ownership, slots and rune limits;
// the sheet uses the same functions to decide which controls to show.
import { RUNE_WEAVER_NAMES, runeFitsItem } from './runeLimits.ts';
import type { SheetWeapon } from './creature.ts';

// Magical items (every rarity, Object of Power included) can be equipped, up to this many at once
export const ITEM_SLOTS = 3;

// ---- Who may do what ----

export type Wielder = { role: string | null; calling: string | null; level: number };

// Reaver: Soul Brand. Wraith: sigil mark. Rune Weaver (or the pack's Tome of Inscription) from level 3: runes.
export function wielderPowers(w: Wielder) {
    return {
        soulBrand: w.role === 'Reaver',
        sigilMark: w.role === 'Wraith',
        runes: !!w.calling && RUNE_WEAVER_NAMES.includes(w.calling) && w.level >= 3,
    };
}

// The options an owned weapon offers, the same as the old sheet: only an equipped weapon has them.
// null = not offered; true/false = offered, and whether it is on now.
export type WeaponOptions = {
    dualWield: boolean | null;   // one-handed weapons: off hand (bonus action, no ability mod on damage)
    twoHands: boolean | null;    // versatile weapons: use the versatile die
    soulBrand: boolean | null;   // Reaver
    sigilMark: boolean | null;   // Wraith
    runes: boolean;              // Rune Weaver: inscribe runes and pick the runed weapon
};

export function weaponOptions(wielder: Wielder, weapon: SheetWeapon): WeaponOptions {
    const none: WeaponOptions = { dualWield: null, twoHands: null, soulBrand: null, sigilMark: null, runes: false };
    if (!weapon.is_equipped) return none;
    const powers = wielderPowers(wielder);
    const oneHanded = !(weapon.properties ?? []).includes('two-handed');
    const dual = oneHanded && !!weapon.dual_wield;
    const versatile = oneHanded && !!weapon.versatile_dice;
    return {
        dualWield: oneHanded ? dual : null,
        twoHands: versatile ? !dual && !!weapon.two_handed : null,
        soulBrand: powers.soulBrand ? !!weapon.soul_branded : null,
        sigilMark: powers.sigilMark ? !!weapon.sigil_marked : null,
        runes: powers.runes,
    };
}

// ---- Requests ----

export type GearKind = 'armor' | 'weapon' | 'item';
export const WEAPON_TOGGLES = { 'dual-wield': 'dual_wield', 'two-hands': 'two_handed', 'soul-brand': 'soul_branded', 'sigil-mark': 'marked' } as const;
export type WeaponToggle = keyof typeof WEAPON_TOGGLES;

const isId = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v > 0;

// Equip / unequip: body { armor_id } | { weapon_id } | { item_id }
export function checkEquipRequest(kind: GearKind, body: unknown): { error: string } | { id: number } {
    const field = `${kind}_id`;
    const id = ((body ?? {}) as Record<string, unknown>)[field];
    if (!isId(id)) return { error: `Which ${kind}? (${field} must be a catalog id)` };
    return { id };
}

// Dual wield / two hands / Soul Brand / sigil mark: body { weapon_id, <flag>: true | false }
export function checkWeaponToggle(toggle: WeaponToggle, body: unknown): { error: string } | { id: number; on: boolean } {
    const b = (body ?? {}) as Record<string, unknown>;
    if (!isId(b.weapon_id)) return { error: 'Which weapon? (weapon_id must be a catalog id)' };
    const flag = WEAPON_TOGGLES[toggle];
    if (typeof b[flag] !== 'boolean') return { error: `${flag} must be true or false` };
    return { id: b.weapon_id as number, on: b[flag] as boolean };
}

// ---- Runes ----

export type RuneCatalogEntry = { id: number | string; name: string; min_level: number | string; item_types: string[]; choice_param?: string | null; effect?: string };
export type RuneInfo = { isRuneWeaver: boolean; level: number; perItem: number; active: number; used: number; wardingTypes: string[]; runes: RuneCatalogEntry[] };
export type ItemRune = { id: number; rune_id: number | string; name: string; choice_value?: string | null; effect?: string };
export type RuneItemType = 'weapon' | 'armor' | 'shield';

// The runes this item can take now (fits the item, level reached, not already on it), and whether the item is full
export function runeChoices(info: RuneInfo, itemType: RuneItemType, itemRunes: ItemRune[]) {
    const onItem = new Set(itemRunes.map((r) => Number(r.rune_id)));
    const options = info.runes.filter((r) => runeFitsItem(r.item_types, itemType) && Number(r.min_level) <= info.level && !onItem.has(Number(r.id)));
    return { options, full: itemRunes.length >= info.perItem };
}

export type RuneRequest =
    | { op: 'inscribe'; kind: 'weapon' | 'armor'; itemId: number; runeId: number; choiceValue?: string }
    | { op: 'remove'; itemRuneId: number }
    | { op: 'runed-weapon'; weaponId: number | null };

// inscribe { kind, item_id, rune_id, choice_value? } · remove { item_rune_id } · runed-weapon { weapon_id | null }
export function checkRuneRequest(op: RuneRequest['op'], body: unknown): { error: string } | { request: RuneRequest } {
    const b = (body ?? {}) as Record<string, unknown>;
    if (op === 'inscribe') {
        if (b.kind !== 'weapon' && b.kind !== 'armor') return { error: 'kind must be weapon or armor' };
        if (!isId(b.item_id)) return { error: 'Which item? (item_id must be a catalog id)' };
        if (!isId(b.rune_id)) return { error: 'Which rune?' };
        if (b.choice_value !== undefined && (typeof b.choice_value !== 'string' || b.choice_value.length === 0 || b.choice_value.length > 30)) {
            return { error: 'choice_value must be a short text' };
        }
        const request: RuneRequest = { op, kind: b.kind as 'weapon' | 'armor', itemId: b.item_id as number, runeId: b.rune_id as number };
        if (b.choice_value !== undefined) request.choiceValue = b.choice_value as string;
        return { request };
    }
    if (op === 'remove') {
        if (!isId(b.item_rune_id)) return { error: 'Which rune? (item_rune_id)' };
        return { request: { op, itemRuneId: b.item_rune_id as number } };
    }
    if (b.weapon_id !== null && !isId(b.weapon_id)) return { error: 'weapon_id must be a catalog id or null' };
    return { request: { op: 'runed-weapon', weaponId: b.weapon_id === null ? null : (b.weapon_id as number) } };
}
