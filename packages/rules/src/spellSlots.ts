import { critMark, type BeamRoll } from './dice.ts';

// Fallback slot counts by level, used only when no class data was loaded: [1st, 2nd, ...]
const SLOT_TABLE: Record<number, number[]> = {
    1: [2],
    2: [3],
    3: [4, 2],
    4: [4, 3],
    5: [4, 3, 2],
    6: [4, 3, 3],
    7: [4, 3, 3, 1],
    8: [4, 3, 3, 2],
    9: [4, 3, 3, 2, 1],
    10: [4, 3, 3, 3, 2],
    11: [4, 3, 3, 3, 2, 1],
    12: [4, 3, 3, 3, 3, 1],
    13: [4, 3, 3, 3, 3, 2, 1],
    14: [4, 3, 3, 3, 3, 3, 1],
    15: [4, 3, 3, 3, 3, 3, 2, 1],
    16: [4, 3, 3, 3, 3, 3, 3, 1],
    17: [4, 3, 3, 3, 3, 3, 3, 2, 1],
    18: [4, 3, 3, 3, 3, 3, 3, 3, 1],
    19: [4, 3, 3, 3, 3, 3, 3, 3, 2, 1],
    20: [4, 3, 3, 3, 3, 3, 3, 3, 3, 1],
    21: [4, 3, 3, 3, 3, 3, 3, 3, 3, 2, 1],
    22: [4, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1],
    23: [4, 3, 3, 3, 3, 3, 3, 3, 3, 3, 2, 1],
    24: [4, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1],
    25: [4, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 2, 1],
    26: [4, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1],
    27: [4, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 2, 1],
    28: [4, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1],
    29: [4, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 2, 1],
    30: [4, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1],
};

// A scaling list from the content pack: [{ level: 5, beams: 2 }, ...]
export type ScalingStep = { level: number; [key: string]: number };

// Spell slots for a level. classSlots = the character's slots from class data ([] = no slots).
export function getSpellSlots(level: number, classSlots?: number[] | null): number[] {
    if (Array.isArray(classSlots)) return classSlots;
    const capped = Math.min(Math.max(level, 1), 30);
    return SLOT_TABLE[capped] || [];
}

// Beams a spell fires at a character level, from spells.beam_scaling. No data = 1 beam.
export function beamsAt(spell: { beam_scaling?: ScalingStep[] | null } | null | undefined, level: number): number {
    const steps = Array.isArray(spell?.beam_scaling) ? spell.beam_scaling : [];
    return steps.reduce((n, st) => (Number(level) >= st.level ? st.beams : n), 1);
}

// The server's beam rolls as one line for the roll feed: "Beam 1: to hit 17, damage 6 | Beam 2: ..."
export function beamRollText(beams: BeamRoll[]): string {
    return beams.map((b, i) => `Beam ${i + 1}: to hit ${b.hit.total}${critMark(b.hit)}${b.damage != null ? `, damage ${b.damage}` : ''}`).join(' | ');
}

// One damage number per beam, e.g. "Damage dealt: 5 + 3 = 8 (2 beams)"
export function beamDamageText(hits: number[], crit = false): string {
    return `Damage dealt: ${hits.join(' + ')} = ${hits.reduce((a, b) => a + b, 0)} (${hits.length} beams)${crit ? ' CRIT!' : ''}`;
}

// Value at a level from a [{ level, <key> }] scaling list, else the base value
export const scaledAt = (steps: ScalingStep[] | null | undefined, key: string, level: number, base: number): number =>
    (Array.isArray(steps) ? steps : []).reduce((v, st) => (Number(level) >= st.level ? st[key] : v), base);
