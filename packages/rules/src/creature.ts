// One shape for everything a sheet shows: a Creature. Sheet blocks read only this, never the raw character,
// so a character, a monster or (later) an NPC can all feed the same blocks.
//
// characterToCreature turns what GET /api/characters/:id answers into a Creature. All the sheet math that used to
// live inside Actions.jsx, ArmorClass.jsx, Skills.jsx and CharacterSheet.jsx is here, so it can be tested,
// and so the server can build the same Creature to resolve actions itself (R5.3).
import { modOf, healthInit, proficiencyBonus } from './math.ts';
import { scaledAt, beamsAt, getSpellSlots, type ScalingStep } from './spellSlots.ts';
import { STATS, SKILLS, statKey, statName, type StatKey } from './stats.ts';
import { getSpellCaps } from './spellLimits.ts';
import { purseOf, type Purse } from './money.ts';
import { featureKey, perRestUses, featureDiceAt, type PerRest, type RestUses } from './features.ts';
import { weaponRuneEffects, armorRuneEffects, runicStrikeDice, utilityRuneEffects, type Rider, type Rune } from './runes.ts';
import { RUNE_CALLING } from './runeLimits.ts';

// ---- What the server sends (only the fields this file reads) ----

export type SheetWeapon = {
    id: number; name: string; is_equipped?: boolean; category?: string | null; weapon_category?: string | null;
    damage_dice?: string | null; versatile_dice?: string | null; damage_type?: string | null;
    properties?: string[] | null; attack_bonus?: number | string | null; rarity?: string | null; description?: string | null;
    range_normal?: number | null; range_long?: number | null;
    dual_wield?: boolean; two_handed?: boolean; soul_branded?: boolean; is_runed?: boolean; sigil_marked?: boolean; sigil_weapon?: boolean;
    runes?: Rune[] | null;
};
export type SheetArmor = {
    id: number; name: string; is_equipped?: boolean; armor_type?: string | null; ac_bonus?: number | string | null;
    con_cap?: number | string | null; runes?: Rune[] | null;
};
export type SheetSpell = {
    id: number; name: string; base_level: number; is_action?: boolean; is_prepared?: boolean; action_type?: string | null;
    attack_type?: string | null; opponent_save_roll?: string | null; base_to_hit_modifier?: number | null;
    base_damage_dice?: string | null; heal_dice?: string | null; heal_add_mod?: boolean; dmgMod?: number;
    beam_scaling?: ScalingStep[] | null;
    upcasts?: { cast_level: number; damage_dice?: string | null; heal_dice?: string | null }[] | null;
    is_racial?: boolean; is_bonus?: boolean;   // race starter / bonus spells: always known, never count toward the caps
};
export type SheetCharacter = {
    id: number; name: string; level: number; portrait_url?: string | null;
    str?: number; dex?: number; con?: number; int?: number; wis?: number; cha?: number; spd?: number; luc?: number;
    max_hp: number; current_hp: number; temp_hp?: number | null;
    spell_stat?: string | null; casting_stat?: string | null; caster_type?: string | null; spell_slots?: number[] | null;
    class_name?: string | null; subclass_name?: string | null; race_name?: string | null; subrace_name?: string | null;
    race_base_speed?: number | null; skill_proficiencies?: string[] | null; class_saving_throws?: string[] | null;
    conditions?: Record<string, boolean> | null; exhaustion?: number | null; used_slots?: Record<string, number> | null;
    rest_uses?: RestUses | null;
    copper?: number | null; silver?: number | null; gold?: number | null; crowns?: number | null; oracles?: number | null;
    has_embers?: boolean; embers_spent?: number | null; cracks?: number | null; crack_max?: number | null;
    breach_dc?: number | null; breach_dc_scaling?: ScalingStep[] | null;
};
// Items and features aren't calculated here; blocks show them as they come (typed loosely until R7 types the server)
export type SheetItem = { id: number; name: string; is_equipped?: boolean; [field: string]: unknown };
export type SheetFeature = { id: number | string; name: string; source?: string; action_type?: string | null; [field: string]: unknown };

export type SheetData = {
    character: SheetCharacter;
    ownedArmor?: SheetArmor[];
    ownedWeapons?: SheetWeapon[];
    ownedItems?: SheetItem[];
    learnedSpells?: SheetSpell[];
    actionFeatures?: SheetFeature[];
};

// ---- The Creature ----

export type WeaponAction = {
    key: string; weaponId: number | null; name: string;
    hit: number; dice: string; dmgMod: number; riders: Rider[];
    stat: string; hands: string; range: string; damageType: string | null;
    oneHanded: boolean; dual: boolean; versatile: boolean; twoHand: boolean;
    branded: boolean; runed: boolean; marked: boolean; sigil: boolean;
    rarity: string | null; description: string | null; category: string | null;
};
// A feature as the sheet shows it: its rest_uses key, uses left (null = no limit) and its dice at this level
export type CreatureFeature = SheetFeature & { key: string; perRest: PerRest | null; diceNow: string | null };

export type SpellAction = SheetSpell & {
    key: string; toHit: number; saveDc: number; beams: number; healMod: number; tile: 'action' | 'bonus' | 'reaction';
};

export type Creature = {
    kind: 'character';
    id: number;
    name: string;
    level: number;
    portrait: string | null;
    species: string | null;          // "Lupine (Husky)"
    role: string | null;
    calling: string | null;
    hp: { current: number; max: number; temp: number; band: number };
    armorClass: { value: number; resist: string[] };
    initiative: number;
    proficiency: number;
    speedFt: number;
    stats: { key: StatKey; label: string; score: number; mod: number }[];
    skills: { id: string; name: string; value: number; proficient: boolean }[];
    conditions: Record<string, boolean>;
    exhaustion: number;
    spellcasting: { toHit: number; saveDc: number; slots: number[]; usedSlots: Record<string, number> };
    // The spell book caps (null = no cap): cantrips, prepared and known spells at this level
    spellLimits: { cantrips: number; prepared: number; known: number; shared?: boolean } | null;
    restUses: RestUses;             // per-rest feature uses spent (characters.rest_uses)
    purse: Purse;                   // coins: copper, silver, gold, crowns, oracles (separate, never auto-changed)
    classDc: number;
    embers: { max: number; current: number };
    cracks: { current: number; max: number; breachDc: number; conSave: number };
    actions: WeaponAction[];          // main-hand weapons + Fists
    bonusActions: WeaponAction[];     // dual-wielded off-hand weapons
    spells: SpellAction[];            // prepared action spells, with their numbers worked out
    strikes: { soulStrikeDice: string; runicStrikeDice: string };
    gear: { armor: SheetArmor[]; weapons: SheetWeapon[]; items: SheetItem[] };
    allSpells: SheetSpell[];          // every learned spell (the spell book), prepared or not
    features: CreatureFeature[];
};

// Dual wield: the off-hand attack is a bonus action and loses the ability modifier on DAMAGE (5e).
// Flip this to true to also drop the modifier from to-hit (proficiency always stays).
export const DUAL_WIELD_DROPS_HIT_MOD = false;

// Fists: the die shrinks as HP drops (full 1d8, 75%+ 1d6, 50%+ 1d4, below 50% a flat 1)
export const FIST_DICE = ['1', '1', '1d4', '1d6', '1d8'];

export function characterToCreature(data: SheetData): Creature {
    const ch = data.character;
    const ownedArmor = data.ownedArmor ?? [];
    const ownedWeapons = data.ownedWeapons ?? [];
    const score = (key: StatKey | undefined): number => (key ? Number(ch[key] ?? 10) : 10);
    const mod = (key: StatKey | undefined) => modOf(score(key));

    const level = Number(ch.level) || 1;
    const prof = proficiencyBonus(level);
    const hpNow = Number(ch.current_hp);
    const hpMax = Number(ch.max_hp);
    const band = healthInit(hpNow, hpMax);

    // Initiative = Precision mod + the health band; it's also the base of every weapon to-hit
    const init = mod('dex') + band;
    const strMod = mod('str');
    // spell_stat = the role's primary stat (weapons); casting_stat = its spellcasting stat (spells)
    const primaryMod = mod(statKey(ch.spell_stat));
    const spellMod = mod(statKey(ch.casting_stat || ch.spell_stat));
    const spellToHit = spellMod + prof;
    const spellSave = 8 + spellToHit;
    const meleeHit = init + primaryMod;

    const isReaver = ch.class_name === 'Reaver';
    const isRuneCaller = ch.subclass_name === RUNE_CALLING && level >= 3;   // Tome of Inscription
    const isWraith = ch.class_name === 'Wraith';
    const cracks = Number(ch.cracks ?? 0);

    const weapons: WeaponAction[] = ownedWeapons.filter((w) => w.is_equipped).map((w) => {
        const properties = w.properties ?? [];
        const ranged = w.category === 'ranged';
        const branded = isReaver && !!w.soul_branded;      // Soul Brand: CHA for attack and damage
        const runed = isRuneCaller && !!w.is_runed;        // Tome of Inscription: INT, Keen +1, element riders
        const marked = isWraith && !!w.sigil_marked;       // Sigil mark: INT, counts as a sigil blade
        const sigil = marked || !!w.sigil_weapon;
        const runeFx = weaponRuneEffects(w);
        const statMod = branded ? mod('cha') : (runed || marked) ? mod('int') : null;
        const abilityMod = statMod ?? (ranged ? mod('dex') : primaryMod);
        const oneHanded = !properties.includes('two-handed');
        const dual = oneHanded && !!w.dual_wield;
        const versatile = oneHanded && !!w.versatile_dice;
        const twoHand = versatile && !dual && !!w.two_handed;   // versatile weapons in two hands use their versatile die
        const hit = (statMod != null ? init + statMod : ranged ? init + mod('dex') : meleeHit) + runeFx.hitBonus;
        return {
            key: `w${w.id}`, weaponId: w.id, name: w.name,
            dice: (twoHand ? w.versatile_dice : w.damage_dice) ?? '1',
            // Seal Cracks: +1 radiant per Crack on sigil hits. Off-hand damage drops the ability mod.
            dmgMod: (dual ? 0 : abilityMod) + (sigil ? cracks : 0),
            hit: dual && DUAL_WIELD_DROPS_HIT_MOD ? hit - abilityMod : hit,
            riders: runeFx.riders,
            stat: branded ? 'CHA' : (runed || marked) ? 'INT' : ranged ? 'DEX' : (statKey(ch.spell_stat) || 'str').toUpperCase(),
            hands: twoHand ? 'Two hands' : oneHanded ? (properties.includes('versatile') ? 'One or two hands' : 'One hand') : 'Two hands',
            range: w.range_normal ? `${w.range_normal}/${w.range_long ?? w.range_normal} ft` : (properties.includes('reach') ? '10 ft (reach)' : '5 ft'),
            damageType: w.damage_type ?? null,
            oneHanded, dual, versatile, twoHand, branded, runed, marked, sigil,
            rarity: w.rarity ?? null, description: w.description ?? null, category: w.weapon_category ?? null,
        };
    });

    const fists: WeaponAction = {
        key: 'fists', weaponId: null, name: 'Fists', hit: init + strMod, dice: FIST_DICE[band], dmgMod: strMod, riders: [],
        stat: 'STR', hands: 'Unarmed', range: '5 ft', damageType: 'bludgeoning',
        oneHanded: true, dual: false, versatile: false, twoHand: false, branded: false, runed: false, marked: false, sigil: false,
        rarity: null, description: null, category: null,
    };

    // Armor class: 10 + CON mod (capped by body armor) + armor + shield + Guard Rune
    const equippedArmor = ownedArmor.filter((a) => a.is_equipped);
    const armorBonus = equippedArmor.filter((a) => a.armor_type !== 'shield').reduce((sum, a) => sum + Number(a.ac_bonus || 0), 0);
    const shieldBonus = equippedArmor.filter((a) => a.armor_type === 'shield').reduce((sum, a) => sum + Number(a.ac_bonus || 0), 0);
    const caps = equippedArmor.filter((a) => a.armor_type !== 'shield' && a.con_cap != null).map((a) => Number(a.con_cap));
    const conMod = caps.length ? Math.min(mod('con'), ...caps) : mod('con');
    const armorRunes = armorRuneEffects(ownedArmor);

    // Distance: (species speed + Speed stat + Fleet Rune 5 ft) scaled by how healthy you are
    const fleetFt = utilityRuneEffects(ownedArmor, ownedWeapons).fleet ? 5 : 0;
    const speedFt = Math.round((Number(ch.race_base_speed ?? 0) + Number(ch.spd ?? 0) + fleetFt) * (hpMax ? hpNow / hpMax : 1));

    // Stolen Radiance (has_embers): ceil(level / 2) + INT mod (min 1), + CON mod from level 17
    const embersMax = ch.has_embers ? Math.max(1, Math.ceil(level / 2) + mod('int') + (level >= 17 ? mod('con') : 0)) : 0;

    const restUses: RestUses = ch.rest_uses ?? {};
    const proficientSkills = ch.skill_proficiencies ?? [];
    const spells = (data.learnedSpells ?? []).filter((s) => s.is_action && s.is_prepared).map((s): SpellAction => {
        const tile = s.action_type === 'bonus' ? 'bonus' : s.action_type === 'reaction' ? 'reaction' : 'action';
        return {
            ...s,
            key: `s${s.id}`,
            toHit: spellToHit + (s.base_to_hit_modifier || 0),
            saveDc: spellSave,
            beams: beamsAt(s, level),
            healMod: s.heal_add_mod ? spellMod : 0,
            tile,
        };
    });

    return {
        kind: 'character',
        id: ch.id,
        name: ch.name,
        level,
        portrait: ch.portrait_url ?? null,
        species: ch.race_name ? `${ch.race_name}${ch.subrace_name ? ` (${ch.subrace_name})` : ''}` : null,
        role: ch.class_name ?? null,
        calling: ch.subclass_name ?? null,
        hp: { current: hpNow, max: hpMax, temp: Number(ch.temp_hp ?? 0), band },
        armorClass: { value: 10 + conMod + armorBonus + shieldBonus + armorRunes.acBonus, resist: armorRunes.resist },
        initiative: init,
        proficiency: prof,
        speedFt,
        stats: STATS.map((s) => ({ key: s.key, label: s.label, score: score(s.key), mod: mod(s.key) })),
        skills: SKILLS.map((s) => {
            const proficient = proficientSkills.includes(s.name);
            return { id: s.id, name: s.name, proficient, value: mod(s.stats[0]) + mod(s.stats[1]) + (proficient ? prof : 0) };
        }),
        conditions: ch.conditions ?? {},
        exhaustion: Number(ch.exhaustion ?? 0),
        spellcasting: { toHit: spellToHit, saveDc: spellSave, slots: getSpellSlots(level, ch.spell_slots), usedSlots: ch.used_slots ?? {} },
        spellLimits: getSpellCaps(ch.class_name, level, ch.subclass_name ?? null),
        restUses,
        purse: purseOf(ch),
        classDc: 8 + prof + mod('cha'),
        embers: { max: embersMax, current: Math.max(0, embersMax - Number(ch.embers_spent ?? 0)) },
        cracks: {
            current: cracks,
            max: Number(ch.crack_max ?? 0),
            breachDc: scaledAt(ch.breach_dc_scaling, 'dc', level, Number(ch.breach_dc ?? 0)),
            conSave: mod('con') + ((ch.class_saving_throws ?? []).includes('CON') ? prof : 0),
        },
        actions: [...weapons.filter((a) => !a.dual), fists],
        bonusActions: weapons.filter((a) => a.dual),
        spells,
        strikes: { soulStrikeDice: level >= 23 ? '3d8' : level >= 11 ? '2d8' : '1d8', runicStrikeDice: runicStrikeDice(level) },
        gear: { armor: ownedArmor, weapons: ownedWeapons, items: data.ownedItems ?? [] },
        allSpells: data.learnedSpells ?? [],
        features: (data.actionFeatures ?? []).map((f) => ({ ...f, key: featureKey(f), perRest: perRestUses(f, level, restUses), diceNow: featureDiceAt(f, level) })),
    };
}

// Damage dice for a spell cast at a level: its spell_upcasts row for that level, else the base dice
export function spellDiceAt(spell: SheetSpell, castLevel: number): string | null {
    const up = (spell.upcasts ?? []).find((u) => u.cast_level === castLevel);
    return up?.damage_dice || spell.base_damage_dice || null;
}

// Healing dice at a level: the upcast's heal_dice, else the spell's
export function spellHealAt(spell: SheetSpell, castLevel: number): string | null {
    const up = (spell.upcasts ?? []).find((u) => u.cast_level === castLevel);
    return up?.heal_dice || spell.heal_dice || null;
}

// The name of a stat for display, e.g. a save: 'DEX' -> 'Precision'
export { statName };
