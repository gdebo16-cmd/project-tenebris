// Features with uses per rest (R5). Shared by the Creature (to show uses left) and sheetState (to spend them).
import { scaledAt, type ScalingStep } from './spellSlots.ts';

export type RestType = 'short' | 'long';
// { featureKey: uses spent since the rest that recovers it } (characters.rest_uses)
export type RestUses = Record<string, number>;

// Only the feature fields read here (the full row is SheetFeature in creature.ts)
type FeatureRow = { id: number | string; name: string; source?: string; [field: string]: unknown };

// A feature's key in rest_uses, the same one the old sheet saved: "class-12", "subclass-40"
export const featureKey = (f: { source?: unknown; id: unknown }): string => `${String(f.source)}-${String(f.id)}`;

// Which rest gives a feature its uses back. Only rest_lock 'short' comes back on a short rest.
export const recoversOn = (f: { rest_lock?: unknown; [field: string]: unknown }): RestType => (f.rest_lock === 'short' ? 'short' : 'long');

export type PerRest = { max: number; used: number; left: number; rest: RestType };

// Uses per rest for one feature at this level (uses_scaling can raise them), or null if it has no limit
export function perRestUses(f: FeatureRow, level: number, restUses: RestUses): PerRest | null {
    if (f.rest_uses == null) return null;
    const max = scaledAt(f.uses_scaling as ScalingStep[] | null, 'uses', level, Number(f.rest_uses));
    const used = Number(restUses[featureKey(f)] ?? 0);
    return { max, used, left: Math.max(0, max - used), rest: recoversOn(f) };
}

// The feature's dice at this level (dice_scaling can raise them), or null
export const featureDiceAt = (f: FeatureRow, level: number): string | null => {
    const dice = scaledAt(f.dice_scaling as ScalingStep[] | null, 'dice', level, f.dice as unknown as number);
    return dice ? String(dice) : null;
};

