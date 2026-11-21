// Rune effects the sheet applies automatically (rune-weaver-inscribe-runes.md): Keen (+1 to hit, not on top of an
// item's own +N), damage riders (Ember/Rime/Spark/Gall), Guard (+1 AC, once) and Warding (resistance).
// Several copies of one effect don't stack.

export type Rune = { id?: number; name: string; dice?: string | null; is_damage_rider?: boolean; choice_value?: string | null };
export type RunedItem = { name?: string; is_equipped?: boolean; attack_bonus?: number | string | null; armor_type?: string | null; runes?: Rune[] | null };
export type Rider = { name: string; dice: string; type: string };

const RIDER_TYPES: Record<string, string> = { 'Ember Rune': 'fire', 'Rime Rune': 'cold', 'Spark Rune': 'lightning', 'Gall Rune': 'acid' };

export function weaponRuneEffects(weapon: RunedItem): { hitBonus: number; riders: Rider[] } {
    const runes = weapon.runes ?? [];
    const keen = runes.some((r) => r.name === 'Keen Rune') && !(Number(weapon.attack_bonus) > 0);
    const riders = runes.filter((r) => r.is_damage_rider).map((r) => ({ name: r.name, dice: r.dice ?? '', type: RIDER_TYPES[r.name] ?? '' }));
    return { hitBonus: keen ? 1 : 0, riders };
}

export function armorRuneEffects(ownedArmor: RunedItem[]): { acBonus: number; resist: string[] } {
    const runes = ownedArmor.filter((a) => a.is_equipped).flatMap((a) => a.runes ?? []);
    return {
        acBonus: runes.some((r) => r.name === 'Guard Rune') ? 1 : 0,
        resist: [...new Set(runes.filter((r) => r.name === 'Warding Rune' && r.choice_value).map((r) => r.choice_value as string))],
    };
}

// Runic Strike: +1d6 force (2d6 at 10, 3d6 at 18, 4d6 at 24)
export const runicStrikeDice = (level: number): string => (level >= 24 ? '4d6' : level >= 18 ? '3d6' : level >= 10 ? '2d6' : '1d6');

// Utility runes on worn armor/shields and equipped weapons. key = rest_uses key for once-per-rest runes.
export type UtilityRune = { key: string; item: string; armor: RunedItem };
export function utilityRuneEffects(ownedArmor: RunedItem[] = [], ownedWeapons: RunedItem[] = []) {
    const items = [...ownedArmor, ...ownedWeapons].filter((i) => i.is_equipped);
    const withRune = (name: string): UtilityRune[] =>
        items.flatMap((i) => (i.runes ?? []).filter((r) => r.name === name).map((r) => ({ key: `rune-${r.id}`, item: i.name ?? '', armor: i })));
    return {
        fleet: withRune('Fleet Rune').length > 0,               // +5 ft walking speed
        dusksight: withRune('Dusksight Rune').length > 0,       // darkvision 30 ft (+30 ft if you already have it)
        lanterns: withRune('Lantern Rune'),                     // bright 20 ft + dim 20 ft, bonus action on/off
        hush: withRune('Hush Rune'),                            // silent; armor with it: no Stealth disadvantage
        anchor: withRune('Anchor Rune'),                        // can't be disarmed or taken while conscious
        homing: withRune('Homing Rune'),                        // thrown returns; ammunition recovered after combat
        mending: withRune('Mending Rune'),                      // self-repairs; 1/long rest reaction: reduce a hit by 1d6 + INT
    };
}
