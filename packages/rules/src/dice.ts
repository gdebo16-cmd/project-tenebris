// Dice for Eldrid Tales. Only the server rolls: it hands these functions its own random
// number source (rng). Tests hand in a fake rng, so every roll in a test is predictable.

// rng(6) returns a whole number from 1 to 6
export type Rng = (sides: number) => number;

// "2d6+3" -> { count: 2, sides: 6, bonus: 3 }
export type DiceParts = { count: number; sides: number; bonus: number };

// Reads dice text. "2d6+3", "d8" (= 1d8), "1d4-1", "5" (a flat 5, no dice).
// Empty means a flat 0. Anything else (like "banana") gives null.
export function parseDice(dice: string | number | null | undefined): DiceParts | null {
    if (dice == null) return { count: 0, sides: 0, bonus: 0 };
    const text = String(dice).replace(/\s/g, '').toLowerCase();   // "3d4 + 3" becomes "3d4+3"
    if (text === '') return { count: 0, sides: 0, bonus: 0 };
    if (/^-?\d+$/.test(text)) return { count: 0, sides: 0, bonus: Number(text) };
    const m = /^(\d*)d(\d+)([+-]\d+)?$/.exec(text);
    if (!m) return null;
    return { count: m[1] === '' ? 1 : Number(m[1]), sides: Number(m[2]), bonus: Number(m[3] ?? 0) };
}

// total includes the bonus; rolls are the single dice, so the table can show them later
export type DiceRoll = { total: number; rolls: number[] };

// Rolls dice text. A critical hit doubles the number of dice, never the bonus.
export function rollDice(dice: string | number | null | undefined, rng: Rng, crit = false): DiceRoll {
    const parts = parseDice(dice);
    if (!parts) throw new Error(`"${dice}" is not a dice roll`);
    const count = crit ? parts.count * 2 : parts.count;
    const rolls = Array.from({ length: count }, () => rng(parts.sides));
    return { total: rolls.reduce((sum, n) => sum + n, parts.bonus), rolls };
}

// A d20 plus a bonus. natural = the die itself; 20 is a crit, 1 is a fail.
export type ToHitRoll = { natural: number; total: number; crit: boolean; fail: boolean };

export function rollToHit(bonus: number, rng: Rng): ToHitRoll {
    const natural = rng(20);
    return { natural, total: natural + bonus, crit: natural === 20, fail: natural === 1 };
}

// " CRIT!" after a natural 20, " (natural 1)" after a 1, nothing otherwise
export const critMark = (r: ToHitRoll): string => (r.crit ? ' CRIT!' : r.fail ? ' (natural 1)' : '');

// Ability score roll: 4d6, the lowest die is dropped
export type StatRoll = { total: number; rolls: number[]; dropped: number };

export function roll4d6DropLowest(rng: Rng): StatRoll {
    const rolls = [rng(6), rng(6), rng(6), rng(6)];
    const dropped = Math.min(...rolls);
    return { total: rolls.reduce((sum, n) => sum + n, 0) - dropped, rolls, dropped };
}

// Multi-beam spells: every beam rolls its own to-hit, and only a beam that crits doubles its dice.
// damage is null when the spell has no damage dice. Damage never goes below 0.
export type BeamRoll = { hit: ToHitRoll; damage: number | null };

export function rollBeams(beams: number, toHit: number, dice: string | null | undefined, dmgMod: number, rng: Rng): BeamRoll[] {
    return Array.from({ length: beams }, () => {
        const hit = rollToHit(toHit, rng);
        const damage = dice ? Math.max(0, rollDice(dice, rng, hit.crit).total + dmgMod) : null;
        return { hit, damage };
    });
}

// ---------------------------------------------------------------------------
// The /api/roll request. The browser asks for named rolls; the server rolls them all at once:
//   { rolls: { hit: { type: 'd20', bonus: 5 }, damage: { type: 'dice', dice: '1d8+3' } } }
// and answers with the same names:
//   { hit: { natural: 14, total: 19, ... }, damage: { total: 7, rolls: [4] } }

export type RollSpec =
    | { type: 'dice'; dice: string; crit?: boolean }
    | { type: 'd20'; bonus?: number }
    | { type: 'stat' }
    | { type: 'percent' }                     // 1 to 100
    | { type: 'beams'; beams: number; toHit: number; dice?: string | null; dmgMod?: number };

// What each kind of spec rolls into
export type RollResultOf<S extends RollSpec> =
    S extends { type: 'dice' } ? DiceRoll :
    S extends { type: 'd20' } ? ToHitRoll :
    S extends { type: 'stat' } ? StatRoll :
    S extends { type: 'percent' } ? number :
    BeamRoll[];

export type RollResults<T extends Record<string, RollSpec>> = { [K in keyof T]: RollResultOf<T[K]> };

// Caps so nobody can ask the server to roll a million dice
export const ROLL_LIMITS = { rolls: 50, dice: 200, sides: 1000, bonus: 1000, beams: 20 };

const isWhole = (n: unknown, max: number): n is number => Number.isInteger(n) && Math.abs(n as number) <= max;

// Checks one spec. Returns an error message, or null when it's fine.
function specError(name: string, spec: unknown): string | null {
    if (typeof spec !== 'object' || spec === null) return `${name}: not a roll`;
    const s = spec as Record<string, unknown>;
    const checkDice = (dice: unknown, crit: unknown): string | null => {
        const parts = parseDice(dice as string);
        if (!parts) return `${name}: "${dice}" is not a dice roll`;
        if (parts.count * (crit ? 2 : 1) > ROLL_LIMITS.dice) return `${name}: too many dice`;
        if (parts.count > 0 && (parts.sides < 1 || parts.sides > ROLL_LIMITS.sides)) return `${name}: dice need 1 to ${ROLL_LIMITS.sides} sides`;
        if (Math.abs(parts.bonus) > ROLL_LIMITS.bonus) return `${name}: bonus too big`;
        return null;
    };
    switch (s.type) {
        case 'dice':
            if (typeof s.dice !== 'string' && typeof s.dice !== 'number') return `${name}: dice missing`;
            return checkDice(s.dice, s.crit);
        case 'd20':
            return s.bonus === undefined || isWhole(s.bonus, ROLL_LIMITS.bonus) ? null : `${name}: bonus must be a whole number`;
        case 'stat':
        case 'percent':
            return null;
        case 'beams': {
            if (!isWhole(s.beams, ROLL_LIMITS.beams) || s.beams < 1) return `${name}: beams must be 1 to ${ROLL_LIMITS.beams}`;
            if (!isWhole(s.toHit, ROLL_LIMITS.bonus)) return `${name}: toHit must be a whole number`;
            if (s.dmgMod !== undefined && !isWhole(s.dmgMod, ROLL_LIMITS.bonus)) return `${name}: dmgMod must be a whole number`;
            if (s.dice == null || s.dice === '') return null;
            const diceError = checkDice(s.dice, true);
            if (diceError) return diceError;
            // every beam can crit, so allow for doubled dice on each one
            return parseDice(s.dice as string)!.count * 2 * s.beams > ROLL_LIMITS.dice ? `${name}: too many dice` : null;
        }
        default:
            return `${name}: unknown roll type "${String(s.type)}"`;
    }
}

// Checks the whole request body before anything is rolled
export function checkRollRequest(body: unknown): { rolls: Record<string, RollSpec> } | { error: string } {
    const rolls = (body as { rolls?: unknown } | null)?.rolls;
    if (typeof rolls !== 'object' || rolls === null || Array.isArray(rolls)) return { error: 'Send { rolls: { name: roll } }' };
    const entries = Object.entries(rolls);
    if (entries.length === 0) return { error: 'Nothing to roll' };
    if (entries.length > ROLL_LIMITS.rolls) return { error: `At most ${ROLL_LIMITS.rolls} rolls at once` };
    for (const [name, spec] of entries) {
        const error = specError(name, spec);
        if (error) return { error };
    }
    return { rolls: rolls as Record<string, RollSpec> };
}

// Rolls one checked spec
export function resolveRoll(spec: RollSpec, rng: Rng): RollResultOf<RollSpec> {
    switch (spec.type) {
        case 'dice': return rollDice(spec.dice, rng, !!spec.crit);
        case 'd20': return rollToHit(spec.bonus ?? 0, rng);
        case 'stat': return roll4d6DropLowest(rng);
        case 'percent': return rng(100);
        case 'beams': return rollBeams(spec.beams, spec.toHit, spec.dice, spec.dmgMod ?? 0, rng);
    }
}

// Rolls every checked spec and keeps the names
export function rollAll<T extends Record<string, RollSpec>>(rolls: T, rng: Rng): RollResults<T> {
    const out: Record<string, unknown> = {};
    for (const [name, spec] of Object.entries(rolls)) out[name] = resolveRoll(spec, rng);
    return out as RollResults<T>;
}
