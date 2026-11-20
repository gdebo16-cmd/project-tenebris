// The sheet's dice. The browser never rolls: it asks the server (POST /api/roll) and shows the answer.
// The roll types and their rules live in @tenebris/rules/dice.
import { api } from './api';
import { beamRollText, beamDamageText } from '@tenebris/rules/spellSlots';
import type { RollSpec, RollResults, ToHitRoll } from '@tenebris/rules/dice';

// Several named rolls in one trip: roll({ hit: { type: 'd20', bonus: 5 }, dmg: { type: 'dice', dice: '1d8' } })
export function roll<T extends Record<string, RollSpec>>(rolls: T): Promise<RollResults<T>> {
    return api<RollResults<T>>('/api/roll', { method: 'POST', body: { rolls } });
}

// A d20 plus a bonus: { natural, total, crit, fail }
export async function rollD20(bonus: number | string = 0): Promise<ToHitRoll> {
    return (await roll({ r: { type: 'd20', bonus: Number(bonus) || 0 } })).r;
}

// Just the total of some dice, e.g. rollTotal('2d6+3')
export async function rollTotal(dice: string, crit = false): Promise<number> {
    return (await roll({ r: { type: 'dice', dice, crit } })).r.total;
}

// 4d6 drop the lowest, for ability scores
export async function rollStat(): Promise<number> {
    return (await roll({ r: { type: 'stat' } })).r.total;
}

// A multi-beam spell's to-hit and damage per beam, as one roll-feed line
export async function rollBeamsText(beams: number, toHit: number | string, dice?: string | null, dmgMod: number | string = 0): Promise<string> {
    const r = await roll({ b: { type: 'beams', beams, toHit: Number(toHit) || 0, dice, dmgMod: Number(dmgMod) || 0 } });
    return beamRollText(r.b);
}

// Damage for every beam (each at least 0), as one roll-feed line
export async function rollBeamDamage(beams: number, dice: string, dmgMod: number | string = 0, crit = false): Promise<string> {
    const specs: Record<string, RollSpec> = {};
    for (let i = 0; i < beams; i++) specs[`b${i}`] = { type: 'dice', dice, crit };
    const r = await roll(specs);
    return beamDamageText(Object.values(r).map((d) => Math.max(0, (d as { total: number }).total + (Number(dmgMod) || 0))), crit);
}
