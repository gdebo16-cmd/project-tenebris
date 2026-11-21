// Spell book rules (learn / prepare), moved out of apiSpellController so the old sheet's routes and the
// new sheet's route (R5) ask the same questions and give the same answers. The server looks up the
// numbers (caps, counts, highest slot) and these functions say yes (null) or no (the message to show).
import type { getSpellCaps } from './spellLimits.ts';

export type SpellCaps = ReturnType<typeof getSpellCaps>;
// How many spells the character has learned and prepared (from character_spells), and whether this spell is one of them
export type SpellCounts = {
    cantrips: number; spells: number; prepared_cantrips: number; prepared_spells: number;
    already: boolean; already_prepared: boolean;
};

export const SPELLBOOK_OPS = ['learn', 'unlearn', 'prepare', 'unprepare', 'setAction', 'removeAction'] as const;
export type SpellbookOp = (typeof SPELLBOOK_OPS)[number];

export function checkSpellbookRequest(body: unknown): { error: string } | { op: SpellbookOp; spellId: number } {
    const b = (body ?? {}) as Record<string, unknown>;
    if (!SPELLBOOK_OPS.includes(b.op as SpellbookOp)) return { error: `op must be one of ${SPELLBOOK_OPS.join(', ')}` };
    const spellId = Number(b.spellId);
    if (!Number.isInteger(spellId) || spellId <= 0) return { error: 'Which spell?' };
    return { op: b.op as SpellbookOp, spellId };
}

// May this spell be learned? Known caps: cantrips = the cantrip limit, leveled spells = 2x the spells limit
// (shared casters count everything toward one total). Re-learning a known spell is never blocked.
export function learnRefusal(o: {
    exists: boolean; featureOnly: boolean; baseLevel: number; highestSlot: number; level: number;
    caps: SpellCaps; counts: SpellCounts | null;
}): string | null {
    if (!o.exists) return 'That spell does not exist';
    if (o.featureOnly) return 'That spell is granted by a class feature and cannot be learned from the spellbook.';
    if (o.baseLevel > o.highestSlot) return `You can't learn level ${o.baseLevel} spells yet. At level ${o.level} you can cast up to level ${o.highestSlot}.`;
    const { caps, counts } = o;
    if (!caps || !counts || counts.already) return null;
    if (caps.shared && counts.cantrips + counts.spells >= caps.known) return `You already know the most spells you can (${caps.known}) at level ${o.level}`;
    if (o.baseLevel === 0 && counts.cantrips >= caps.cantrips) return `You already know the most cantrips you can (${caps.cantrips}) at level ${o.level}`;
    if (o.baseLevel >= 1 && counts.spells >= caps.known) return `You already know the most spells you can (${caps.known}) at level ${o.level}`;
    return null;
}

// May this learned spell be prepared? Leveled spells up to the prepared limit, cantrips up to the cantrip limit.
export function prepareRefusal(o: { baseLevel: number; level: number; caps: SpellCaps; counts: SpellCounts | null }): string | null {
    const { caps, counts } = o;
    if (!caps || !counts) return null;
    if (!counts.already) return 'You have to learn that spell first';
    if (counts.already_prepared) return null;
    if (caps.shared && counts.prepared_cantrips + counts.prepared_spells >= caps.prepared) return `You can prepare ${caps.prepared} spells at level ${o.level}. Unprepare one first.`;
    if (o.baseLevel === 0 && counts.prepared_cantrips >= caps.cantrips) return `You can prepare ${caps.cantrips} cantrips at level ${o.level}`;
    if (o.baseLevel >= 1 && counts.prepared_spells >= caps.prepared) return `You can prepare ${caps.prepared} spells at level ${o.level}. Unprepare one first.`;
    return null;
}
