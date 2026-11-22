// Sheet state that changes between rolls (R5): per-rest feature uses, short and long rests, and spending spell slots.
// The server owns all of it. The browser only says what it wants ("use this feature", "take a short rest",
// "cast this spell at level 2"); these functions decide what happens, and the server saves the result.
// Ported from the old sheet (CharacterSheet.jsx rest(), spendSlot() and Actions.jsx activateFeature()).
import { rollDice, rollToHit, rollBeams, critMark, type Rng } from './dice.ts';
import { beamRollText } from './spellSlots.ts';
import { spellDiceAt, spellHealAt, type Creature, type SheetFeature } from './creature.ts';
import { featureKey, recoversOn, perRestUses, featureDiceAt, type RestType, type RestUses } from './features.ts';
import { statName } from './stats.ts';

export type { RestType, RestUses };
export type UsedSlots = Record<string, number>;

// ---- Per-rest feature uses ----

export type FeatureUseResult = { error: string } | { text: string; restUses: RestUses };

// Use a feature: spend one of its per-rest uses (if it has any) and roll its dice (if it has any).
// A feature with neither has nothing for the server to do.
export function spendFeatureUse(creature: Creature, key: string, rng: Rng): FeatureUseResult {
    const f = creature.features.find((x) => featureKey(x) === key);
    if (!f) return { error: "That isn't one of this character's features" };
    const uses = perRestUses(f, creature.level, creature.restUses);
    const dice = featureDiceAt(f, creature.level);
    if (!uses && !dice) return { error: `${f.name} has nothing to use or roll` };
    if (uses && uses.left <= 0) return { error: `${f.name}: no uses left (${uses.used}/${uses.max}) until your next ${uses.rest} rest.` };

    const restUses = uses ? { ...creature.restUses, [key]: uses.used + 1 } : creature.restUses;
    const usesText = uses ? ` [${uses.left - 1}/${uses.max} uses left]` : '';
    const rolled = dice ? ` Rolled ${dice}: ${rollDice(dice, rng).total}` : '';
    return { text: `${creature.name} uses ${f.name}${usesText}!${rolled}`, restUses };
}


// ---- Utility rune actions ----

export function checkRuneRequest(body: unknown): { error: string } | { runeKey: string } {
    const key = (body as { runeKey?: unknown } | null)?.runeKey;
    if (typeof key !== 'string' || key.length === 0 || key.length > 60) return { error: 'Which rune?' };
    return { runeKey: key };
}

// Mending Rune: 1/long rest reaction, reduce a hit by 1d6 + INT. The use is saved as rest_uses["rune-..."],
// which takeRest already holds through a short rest and clears on a long rest.
export function useMendingRune(creature: Creature, runeKey: string, rng: Rng): FeatureUseResult {
    const rune = creature.utilityRunes.mending.find((m) => m.key === runeKey);
    if (!rune) return { error: 'No Mending Rune on an equipped item' };
    if (creature.restUses[runeKey]) return { error: 'Mending Rune: used until your next long rest.' };
    const intMod = creature.stats.find((s) => s.key === 'int')?.mod ?? 0;
    const n = Math.max(0, rollDice('1d6', rng).total + intMod);
    return {
        text: `Mending Rune (${rune.item}): reduce the hit's damage by ${n} (reaction, 1/long rest).`,
        restUses: { ...creature.restUses, [runeKey]: 1 },
    };
}

// ---- Rests ----

export type RestInput = {
    hp: { current: number; max: number; temp: number };
    usedSlots: UsedSlots;
    conditions: Record<string, boolean>;
    exhaustion: number;
    restUses: RestUses;
    features: SheetFeature[];
};

export type RestResult = {
    percent: number;                 // how much came back: 20–60 on a short rest, 100 on a long rest
    heal: number;                    // HP to add (the server clamps to max)
    clearTemp: boolean;              // temporary HP is gone after a long rest
    usedSlots: UsedSlots;
    conditions: Record<string, boolean>;
    exhaustion: number;
    restUses: RestUses;
    text: string;
};

// A long rest restores everything. A short rest rolls 1d41+19 (20–60%) for how much comes back:
// that share of missing HP, of spent slots and of exhaustion. Each active condition also rolls a percent
// and stays only if it beats the recovery. Feature uses come back if they recover on a short rest
// (rune and Body Magic uses, saved as "rune-…" and "body-…", wait for a long rest, as on the old sheet).
export function takeRest(type: RestType, s: RestInput, rng: Rng): RestResult {
    const active = Object.keys(s.conditions).filter((name) => s.conditions[name]);
    const percent = type === 'long' ? 100 : rollDice('1d41+19', rng).total;
    const conditionRolls = type === 'long' ? [] : active.map(() => rng(100));
    const share = percent / 100;

    const usedSlots: UsedSlots = {};
    for (const [lvl, used] of Object.entries(s.usedSlots)) usedSlots[lvl] = Number(used) - Math.round(Number(used) * share);

    const conditions: Record<string, boolean> = {};
    for (const [name, on] of Object.entries(s.conditions)) {
        conditions[name] = !!on && type !== 'long' && conditionRolls[active.indexOf(name)] > percent;
    }

    const restUses: RestUses = {};
    if (type === 'short') {
        for (const f of s.features) {
            const key = featureKey(f);
            if (s.restUses[key] && recoversOn(f) === 'long') restUses[key] = s.restUses[key];
        }
        for (const [key, n] of Object.entries(s.restUses)) if (key.startsWith('rune-') || key.startsWith('body-')) restUses[key] = n;
    }

    return {
        percent,
        heal: Math.max(0, Math.round((s.hp.max - s.hp.current) * share)),
        clearTemp: type === 'long' && s.hp.temp > 0,
        usedSlots,
        conditions,
        exhaustion: s.exhaustion - Math.round(s.exhaustion * share),
        restUses,
        text: type === 'long' ? 'Long Rest: fully restored!' : `Short rest: restored ${percent}%`,
    };
}

export function checkRestRequest(body: unknown): { error: string } | { type: RestType } {
    const type = (body as { type?: unknown } | null)?.type;
    if (type !== 'short' && type !== 'long') return { error: 'type must be short or long' };
    return { type };
}

// ---- Spell slots ----

// Spend one slot at this level. Cantrips (level 0) are free.
export function spendSlot(slots: number[], usedSlots: UsedSlots, level: number): { error: string } | { usedSlots: UsedSlots } {
    if (level === 0) return { usedSlots };
    const total = slots[level - 1] ?? 0;
    const used = Number(usedSlots[level] ?? 0);
    if (used >= total) return { error: `No level ${level} slots left!` };
    return { usedSlots: { ...usedSlots, [level]: used + 1 } };
}

export type CastRequest = { actionKey: string; castLevel?: number };

export function checkCastRequest(body: unknown): { error: string } | { request: CastRequest } {
    const b = (body ?? {}) as Record<string, unknown>;
    if (typeof b.actionKey !== 'string' || b.actionKey.length === 0 || b.actionKey.length > 60) return { error: 'Which spell?' };
    const castLevel = b.castLevel == null ? undefined : Number(b.castLevel);
    if (castLevel !== undefined && (!Number.isInteger(castLevel) || castLevel < 0 || castLevel > 9)) return { error: 'castLevel must be 0 to 9' };
    return { request: { actionKey: b.actionKey, castLevel } };
}

export type CastResult = { error: string } | { text: string; critKey: string | null; usedSlots: UsedSlots };

// Cast a prepared action spell: check the level, spend the slot, then roll what the spell does
// (to hit for an attack, the target's save for a save spell, else damage, else healing).
// Nothing is spent when the cast is refused.
export function castSpell(creature: Creature, request: CastRequest, rng: Rng): CastResult {
    const s = creature.spells.find((x) => x.key === request.actionKey);
    if (!s) return { error: "That isn't one of this character's prepared spells" };
    const level = request.castLevel ?? s.base_level;
    if (level < s.base_level) return { error: `${s.name} can't be cast below level ${s.base_level}` };
    if (s.base_level === 0 && level !== 0) return { error: `${s.name} is a cantrip` };

    const spent = spendSlot(creature.spellcasting.slots, creature.spellcasting.usedSlots, level);
    if ('error' in spent) return spent;

    const start = `${creature.name} casts ${s.name}${level > s.base_level ? ` at level ${level}` : ''}! `;
    const dice = spellDiceAt(s, level);
    const heal = spellHealAt(s, level);
    const done = (text: string, critKey: string | null = null): CastResult => ({ text: `${start}${text}`.trim(), critKey, usedSlots: spent.usedSlots });

    if (s.attack_type) {
        if (s.beams > 1) return done(beamRollText(rollBeams(s.beams, s.toHit, dice, s.dmgMod ?? 0, rng)));
        const r = rollToHit(s.toHit, rng);
        return done(`Chance to hit: ${r.total}${critMark(r)}`, r.crit ? s.key : null);
    }
    if (s.opponent_save_roll) return done(`Target makes a ${statName(s.opponent_save_roll)} roll against ${s.saveDc}.`);
    if (dice) return done(`Damage dealt: ${Math.max(0, rollDice(dice, rng).total + (s.dmgMod ?? 0))}`);
    if (heal) return done(`Healed: ${Math.max(0, rollDice(heal, rng).total + s.healMod)}`);
    return done('');
}

// ---- Conditions and exhaustion ----

// The 12 conditions a character can have (characters.conditions keys)
export const CONDITIONS = ['blind', 'charm', 'deaf', 'lock', 'mad', 'disease', 'panic', 'out', 'bleed', 'ground', 'weak', 'sleep'] as const;
export type ConditionName = (typeof CONDITIONS)[number];
export const MAX_EXHAUSTION = 10;

export type ConditionsRequest = { conditions?: Partial<Record<ConditionName, boolean>>; exhaustion?: number };

// { conditions?: { blind: true, ... }, exhaustion?: 0..10 }. Only known conditions, true/false; at least one change.
export function checkConditionsRequest(body: unknown): { error: string } | { request: ConditionsRequest } {
    const b = (body ?? {}) as Record<string, unknown>;
    const request: ConditionsRequest = {};
    if (b.conditions !== undefined) {
        if (b.conditions === null || typeof b.conditions !== 'object' || Array.isArray(b.conditions)) return { error: 'conditions must be { name: true or false }' };
        const conditions: Partial<Record<ConditionName, boolean>> = {};
        for (const [name, on] of Object.entries(b.conditions as Record<string, unknown>)) {
            if (!(CONDITIONS as readonly string[]).includes(name)) return { error: `There is no condition called "${name}"` };
            if (typeof on !== 'boolean') return { error: `${name} must be true or false` };
            conditions[name as ConditionName] = on;
        }
        request.conditions = conditions;
    }
    if (b.exhaustion !== undefined) {
        const n = b.exhaustion;
        if (typeof n !== 'number' || !Number.isInteger(n) || n < 0 || n > MAX_EXHAUSTION) return { error: `exhaustion must be a whole number from 0 to ${MAX_EXHAUSTION}` };
        request.exhaustion = n;
    }
    if (request.conditions === undefined && request.exhaustion === undefined) return { error: 'Change a condition or exhaustion' };
    return { request };
}

// The saved state after a change: named conditions are set, the others stay as they are
export function applyConditions(current: { conditions: Record<string, boolean>; exhaustion: number }, request: ConditionsRequest) {
    return {
        conditions: { ...current.conditions, ...request.conditions },
        exhaustion: request.exhaustion ?? current.exhaustion,
    };
}
