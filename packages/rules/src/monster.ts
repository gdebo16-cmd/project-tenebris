// Monsters (R5.6): a content-pack monster plus its campaign row (HP, conditions) becomes the same Creature
// the character sheet reads, so the same blocks show it and the same resolveAct rolls for it.
//
// Monster math follows the character rules where the pack doesn't say otherwise:
//   to-hit   = initiative (Precision mod + health band) + the attack's stat mod + its to_hit_bonus
//   damage   = the attack's dice + its stat mod; extra_dice become a rider of extra_type
//   prof.    = the proficiency bonus at a level equal to the threat level
//   skills   = the two stats' mods, + the pack's skill_bonuses (a bonus marks the skill as trained)
//   distance = walking speed (speed.walk, else spd), scaled by how healthy it is, like a character's
import { modOf, healthInit, proficiencyBonus } from './math.ts';
import { STATS, SKILLS, statKey, type StatKey } from './stats.ts';
import { purseOf } from './money.ts';
import type { HpRequest, TempHpRequest } from './health.ts';
import type { Creature, CreatureFeature, WeaponAction } from './creature.ts';

// ---- What the content pack and the database hold ----

export type PackAttack = {
    name: string; stat?: string | null; to_hit_bonus?: number | null;
    damage_dice?: string | null; damage_type?: string | null; extra_dice?: string | null; extra_type?: string | null;
    reach?: number | null; range?: string | null; action_type?: string | null;
};
export type PackAbility = { name: string; action_type?: string | null; uses?: number | null; recharge?: string | null; description?: string | null };

export type PackMonster = {
    id: number; name: string; description?: string | null; art_url?: string | null; size_id?: number | null;
    type?: string | null; threat_level?: number | null; xp?: number | null;
    str?: number; dex?: number; con?: number; int?: number; wis?: number; cha?: number; spd?: number; luc?: number;
    save_proficiencies?: string[] | null; skill_bonuses?: Record<string, number> | null;
    max_hp: number; hit_dice?: string | null; armor?: number | null;
    speed?: Record<string, number> | null; travel?: Record<string, number> | null;
    senses?: Record<string, number> | null; languages?: string[] | null;
    resistances?: string[] | null; immunities?: string[] | null; weaknesses?: string[] | null; condition_immunities?: string[] | null;
    attacks?: PackAttack[] | null; multiattack?: boolean | null;
    features?: PackAbility[] | null; reactions?: PackAbility[] | null; legendary_actions?: PackAbility[] | null;
};

// A row of campaign_monsters: one monster a DM added to a campaign
export type CampaignMonsterRow = {
    id: number; campaign_id: number; monster_id: number; nickname?: string | null;
    current_hp: number; temp_hp?: number | null; conditions?: Record<string, boolean> | null; exhaustion?: number | null;
    notes?: string | null;
};

// What only the monster has (the sheet's header and Traits block read this)
export type MonsterInfo = {
    rowId: number;
    campaignId: number;
    monsterId: number;
    packName: string;
    type: string | null;
    threat: number;
    xp: number;
    description: string | null;
    hitDice: string | null;
    saves: string[];                   // stat labels, e.g. ['Precision']
    senses: Record<string, number>;
    movement: Record<string, number>;  // walk / climb / fly / swim (only the ones it has)
    languages: string[];
    resistances: string[];
    immunities: string[];
    weaknesses: string[];
    conditionImmunities: string[];
    multiattack: boolean;
    notes: string;
};

const unique = (list: string[] | null | undefined): string[] => [...new Set((list ?? []).filter(Boolean))];
const positive = (rec: Record<string, number> | null | undefined): Record<string, number> =>
    Object.fromEntries(Object.entries(rec ?? {}).filter(([, v]) => Number(v) > 0).map(([k, v]) => [k, Number(v)]));

// ---- Health in words: what players see instead of the numbers ----

export type HealthWord = 'Unhurt' | 'Wounded' | 'Bloodied' | 'Near death' | 'Down';

export function healthWord(current: number, max: number): HealthWord {
    if (current <= 0) return 'Down';
    if (max <= 0 || current >= max) return 'Unhurt';
    const pct = current / max;
    if (pct >= 0.5) return 'Wounded';
    if (pct >= 0.25) return 'Bloodied';
    return 'Near death';
}

// ---- The adapter ----

export function monsterToCreature(m: PackMonster, row: CampaignMonsterRow): Creature {
    const score = (key: StatKey): number => Number(m[key] ?? 10);
    const mod = (key: StatKey) => modOf(score(key));

    const threat = Math.max(0, Number(m.threat_level ?? 0));
    const prof = proficiencyBonus(Math.max(1, threat));
    const hpMax = Number(m.max_hp) || 0;
    const hpNow = Number(row.current_hp);
    const band = healthInit(hpNow, hpMax);
    const init = mod('dex') + band;

    const actions: WeaponAction[] = [];
    const bonusActions: WeaponAction[] = [];
    (m.attacks ?? []).forEach((a, i) => {
        const stat = statKey(a.stat) ?? 'str';
        const action: WeaponAction = {
            key: `a${i}`, weaponId: null, name: a.name,
            hit: init + mod(stat) + Number(a.to_hit_bonus ?? 0),
            dice: a.damage_dice || '1',
            dmgMod: mod(stat),
            riders: a.extra_dice ? [{ name: a.name, dice: a.extra_dice, type: a.extra_type ?? 'extra' }] : [],
            stat: stat.toUpperCase(),
            hands: a.action_type === 'bonus' ? 'Bonus action' : a.action_type === 'reaction' ? 'Reaction' : 'Action',
            range: a.range ?? `${a.reach ?? 5} ft`,
            damageType: a.damage_type ?? null,
            oneHanded: true, dual: false, versatile: false, twoHand: false, branded: false, runed: false, marked: false, sigil: false,
            rarity: null, description: a.damage_type ? `${a.damage_type}${a.extra_dice ? ` + ${a.extra_dice} ${a.extra_type ?? ''}`.trimEnd() : ''}` : null,
            category: null,
        };
        (a.action_type === 'bonus' ? bonusActions : actions).push(action);
    });

    // Features, reactions and legendary actions, shown as features (no per-rest uses or dice yet)
    const abilities = [...(m.features ?? []), ...(m.reactions ?? []), ...(m.legendary_actions ?? [])];
    const features: CreatureFeature[] = abilities.map((f, i) => ({
        id: i, name: f.name, source: 'monster', action_type: f.action_type ?? null,
        description: f.description ?? null, recharge: f.recharge ?? null,
        key: `monster-${i}`, perRest: null, diceNow: null,
    }));

    const skillBonuses = m.skill_bonuses ?? {};
    const saves = (m.save_proficiencies ?? []).map((s) => statKey(s)).filter((k): k is StatKey => !!k);
    const movement = positive({ ...(m.speed ?? {}), ...(m.travel ?? {}) });
    const walk = Number(m.speed?.walk ?? m.spd ?? 0);
    const spellMod = mod('int');

    return {
        kind: 'monster',
        id: row.id,
        name: row.nickname || m.name,
        level: Math.max(1, threat),
        portrait: m.art_url ?? null,
        species: null,
        role: null,
        calling: null,
        hp: { current: hpNow, max: hpMax, temp: Number(row.temp_hp ?? 0), band },
        armorClass: { value: Number(m.armor ?? 10), resist: unique(m.resistances) },
        initiative: init,
        proficiency: prof,
        speedFt: Math.round(walk * (hpMax ? hpNow / hpMax : 1)),
        stats: STATS.map((s) => ({ key: s.key, label: s.label, score: score(s.key), mod: mod(s.key) })),
        skills: SKILLS.map((s) => {
            const bonus = Number(skillBonuses[s.id] ?? 0);
            return { id: s.id, name: s.name, proficient: bonus !== 0, value: mod(s.stats[0]) + mod(s.stats[1]) + bonus };
        }),
        conditions: row.conditions ?? {},
        exhaustion: Number(row.exhaustion ?? 0),
        spellcasting: { toHit: spellMod + prof, saveDc: 8 + spellMod + prof, slots: [], usedSlots: {} },
        spellLimits: null,
        restUses: {},
        purse: purseOf(null),
        classDc: 8 + prof + mod('cha'),
        embers: { max: 0, current: 0 },
        cracks: { current: 0, max: 0, breachDc: 0, conSave: 0 },
        actions,
        bonusActions,
        spells: [],
        strikes: { soulStrikeDice: '', runicStrikeDice: '' },
        gear: { armor: [], weapons: [], items: [] },
        allSpells: [],
        features,
        monster: {
            rowId: row.id,
            campaignId: row.campaign_id,
            monsterId: m.id,
            packName: m.name,
            type: m.type ?? null,
            threat,
            xp: Number(m.xp ?? 0),
            description: m.description ?? null,
            hitDice: m.hit_dice ?? null,
            saves: saves.map((k) => STATS.find((s) => s.key === k)?.label ?? k),
            senses: positive(m.senses),
            movement,
            languages: m.languages ?? [],
            resistances: unique(m.resistances),
            immunities: unique(m.immunities),
            weaknesses: unique(m.weaknesses),
            conditionImmunities: unique(m.condition_immunities),
            multiattack: !!m.multiattack,
            notes: row.notes ?? '',
        },
    };
}

// ---- What a player sees of a monster ----
// Name, type, a health word and the conditions it has. Exact HP, stats and actions stay with the DM.

export type MonsterGlimpse = {
    id: number; name: string; type: string | null; portrait: string | null;
    health: HealthWord; conditions: string[];
};

export function monsterGlimpse(c: Creature): MonsterGlimpse {
    return {
        id: c.id,
        name: c.name,
        type: c.monster?.type ?? null,
        portrait: c.portrait,
        health: healthWord(c.hp.current, c.hp.max),
        conditions: Object.entries(c.conditions).filter(([, on]) => on).map(([name]) => name),
    };
}

// ---- HP changes (the DM's Damage / Heal / Ward) ----
// Same rules as a character's: damage eats temporary HP first and stops at 0, healing stops at max HP,
// and temporary HP doesn't stack (the higher one stays).

export type MonsterHp = { current_hp: number; temp_hp: number };

export function applyMonsterHp(now: MonsterHp, max: number, r: HpRequest): MonsterHp {
    if (r.action === 'heal') return { current_hp: Math.min(max, now.current_hp + r.amount), temp_hp: now.temp_hp };
    const fromTemp = Math.min(now.temp_hp, r.amount);
    return { current_hp: Math.max(0, now.current_hp - (r.amount - fromTemp)), temp_hp: now.temp_hp - fromTemp };
}

export function applyMonsterTempHp(now: MonsterHp, r: TempHpRequest): MonsterHp {
    return { current_hp: now.current_hp, temp_hp: r.clear ? 0 : Math.max(now.temp_hp, r.amount) };
}

// ---- Adding a monster and its notes ----

export const MAX_NICKNAME = 60;
export const MAX_NOTES = 20000;

// { monster_id, nickname? }
export function checkAddMonster(body: unknown): { error: string } | { monsterId: number; nickname: string | null } {
    const b = (body ?? {}) as Record<string, unknown>;
    const monsterId = Number(b.monster_id);
    if (!Number.isInteger(monsterId) || monsterId < 1) return { error: 'Which monster?' };
    if (b.nickname != null && typeof b.nickname !== 'string') return { error: 'nickname must be text' };
    const nickname = typeof b.nickname === 'string' ? b.nickname.trim() : '';
    if (nickname.length > MAX_NICKNAME) return { error: `nickname is at most ${MAX_NICKNAME} characters` };
    return { monsterId, nickname: nickname || null };
}

// { notes }
export function checkNotes(body: unknown): { error: string } | { notes: string } {
    const notes = ((body ?? {}) as Record<string, unknown>).notes;
    if (typeof notes !== 'string') return { error: 'notes must be text' };
    if (notes.length > MAX_NOTES) return { error: `notes are at most ${MAX_NOTES} characters` };
    return { notes };
}
