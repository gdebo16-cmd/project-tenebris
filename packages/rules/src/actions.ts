// Resolving a sheet action on the server: the browser says WHICH action (and hit or damage),
// never the dice, the bonus or whether it crit. The server builds the Creature, finds the action and rolls.
import { rollDice, rollToHit, rollBeams, critMark, type Rng } from './dice.ts';
import { beamRollText, beamDamageText, scaledAt, type ScalingStep } from './spellSlots.ts';
import { spellDiceAt, spellHealAt, type Creature, type WeaponAction, type SpellAction } from './creature.ts';

// check = a plain d20 check: actionKey 'initiative', 'stat:<str|dex|…>' or 'skill:<skill id>'
export type ActKind = 'hit' | 'damage' | 'heal' | 'check';
// Extra dice added to a weapon hit: Soul Strike (Reaver), Runic Strike (Tome of Inscription), or an on-hit feature (Sigil Strike)
export type ActRequest = { actionKey: string; kind: ActKind; castLevel?: number; extra?: 'soulStrike' | 'runicStrike'; featureKey?: string };

const KINDS: ActKind[] = ['hit', 'damage', 'heal', 'check'];

// Checks the request body. Only names and small numbers are accepted; no dice, no bonuses.
export function checkActRequest(body: unknown): { error: string } | { request: ActRequest } {
    const b = (body ?? {}) as Record<string, unknown>;
    if (typeof b.actionKey !== 'string' || b.actionKey.length === 0 || b.actionKey.length > 60) return { error: 'Which action?' };
    if (!KINDS.includes(b.kind as ActKind)) return { error: 'kind must be hit, damage, heal or check' };
    const castLevel = b.castLevel == null ? undefined : Number(b.castLevel);
    if (castLevel !== undefined && (!Number.isInteger(castLevel) || castLevel < 0 || castLevel > 9)) return { error: 'castLevel must be 0 to 9' };
    const extra = b.extra == null ? undefined : b.extra;
    if (extra !== undefined && extra !== 'soulStrike' && extra !== 'runicStrike') return { error: 'Unknown extra' };
    const featureKey = typeof b.featureKey === 'string' ? b.featureKey : undefined;
    return { request: { actionKey: b.actionKey, kind: b.kind as ActKind, castLevel, extra, featureKey } };
}

export type ActResult = { error: string } | { text: string; critKey: string | null };

// lastCritKey = the action whose last to-hit was a natural 20 (the server remembers it), so its next damage crits.
export function resolveAct(creature: Creature, request: ActRequest, lastCritKey: string | null, rng: Rng): ActResult {
    if (request.kind === 'check') return resolveCheck(creature, request.actionKey, rng);
    const weapon = [...creature.actions, ...creature.bonusActions].find((a) => a.key === request.actionKey);
    if (weapon) return resolveWeapon(creature, weapon, request, lastCritKey, rng);
    const spell = creature.spells.find((s) => s.key === request.actionKey);
    if (spell) return resolveSpell(creature, spell, request, lastCritKey, rng);
    return { error: "That isn't one of this character's actions" };
}

function resolveWeapon(creature: Creature, a: WeaponAction, request: ActRequest, lastCritKey: string | null, rng: Rng): ActResult {
    if (request.kind === 'hit') {
        const r = rollToHit(a.hit, rng);
        return { text: `Chance to hit: ${r.total}${critMark(r)}`, critKey: r.crit ? a.key : null };
    }
    if (request.kind !== 'damage') return { error: 'Weapons roll hit or damage' };

    // Check the extra before rolling anything, so a refused request rolls no dice
    const extra = extraFor(creature, a, request);
    if ('error' in extra) return extra;

    // A natural 20 on this weapon's last to-hit doubles the dice (never the flat bonus), then the crit is used up
    const crit = lastCritKey === a.key;
    const weapon = Math.max(0, rollDice(a.dice, rng, crit).total + a.dmgMod);
    const riders = a.riders.map((r) => ({ ...r, n: rollDice(r.dice, rng, crit).total }));
    const riderText = riders.map((r) => ` + ${r.n} ${r.type}`).join('');
    const riderSum = riders.reduce((sum, r) => sum + r.n, 0);
    const critText = crit ? ' CRIT!' : '';

    if (extra.dice) {
        const n = rollDice(extra.dice, rng, crit).total;
        return { text: `Damage dealt: ${weapon}${riderText} + ${extra.label} ${n} ${extra.type} = ${weapon + riderSum + n}${critText}${extra.note}`, critKey: null };
    }
    return { text: `Damage dealt: ${weapon}${riders.length ? `${riderText} = ${weapon + riderSum}` : ''}${critText}`, critKey: null };
}

// The extra dice a weapon hit may add, checked against what this creature and weapon can actually do
function extraFor(creature: Creature, a: WeaponAction, request: ActRequest): { error: string } | { dice: string | null; label: string; type: string; note: string } {
    if (request.extra === 'soulStrike') {
        if (!a.branded) return { error: 'Soul Strike needs the soul-branded weapon' };
        return { dice: creature.strikes.soulStrikeDice, label: 'Soul Strike', type: 'force', note: ' (spend 1 Temper)' };
    }
    if (request.extra === 'runicStrike') {
        if (!a.runed) return { error: 'Runic Strike needs the runed weapon' };
        return { dice: creature.strikes.runicStrikeDice, label: 'Runic Strike', type: 'force', note: ' (once per turn)' };
    }
    if (request.featureKey) {
        const f = creature.features.find((x) => `${x.source}-${x.id}` === request.featureKey && x.on_weapon_hit);
        if (!f || !a.sigil) return { error: 'That feature does not add to this weapon' };
        const dice = scaledAt(f.dice_scaling as ScalingStep[] | null, 'dice', creature.level, f.dice as unknown as number);
        return { dice: String(dice ?? ''), label: f.name, type: 'radiant', note: '' };
    }
    return { dice: null, label: '', type: '', note: '' };
}

function resolveSpell(creature: Creature, s: SpellAction, request: ActRequest, lastCritKey: string | null, rng: Rng): ActResult {
    const castLevel = request.castLevel ?? s.base_level;
    if (castLevel < s.base_level) return { error: `${s.name} can't be cast below level ${s.base_level}` };
    const dice = spellDiceAt(s, castLevel);
    const dmgMod = s.dmgMod ?? 0;

    if (request.kind === 'hit') {
        if (!s.attack_type) return { error: `${s.name} doesn't roll to hit` };
        if (s.beams > 1) return { text: beamRollText(rollBeams(s.beams, s.toHit, dice, dmgMod, rng)), critKey: null };
        const r = rollToHit(s.toHit, rng);
        return { text: `Chance to hit: ${r.total}${critMark(r)}`, critKey: r.crit ? s.key : null };
    }
    if (request.kind === 'heal') {
        const heal = spellHealAt(s, castLevel);
        if (!heal) return { error: `${s.name} doesn't heal` };
        return { text: `Healed: ${Math.max(0, rollDice(heal, rng).total + s.healMod)}`, critKey: null };   // healing never crits
    }
    if (!dice) return { error: `${s.name} doesn't deal damage` };
    const crit = lastCritKey === s.key;
    if (s.beams > 1) {
        const hits = Array.from({ length: s.beams }, () => Math.max(0, rollDice(dice, rng, crit).total + dmgMod));
        return { text: beamDamageText(hits, crit), critKey: null };
    }
    return { text: `Damage dealt: ${Math.max(0, rollDice(dice, rng, crit).total + dmgMod)}${crit ? ' CRIT!' : ''}`, critKey: null };
}

// Plain d20 checks, with the bonus worked out from the Creature (never sent by the browser)
function resolveCheck(creature: Creature, key: string, rng: Rng): ActResult {
    let label: string | null = null;
    let bonus = 0;
    if (key === 'initiative') { label = 'Initiative'; bonus = creature.initiative; }
    const stat = key.startsWith('stat:') ? creature.stats.find((s) => s.key === key.slice(5)) : undefined;
    if (stat) { label = `${stat.label} roll`; bonus = stat.mod; }
    const skill = key.startsWith('skill:') ? creature.skills.find((s) => s.id === key.slice(6)) : undefined;
    if (skill) { label = `${skill.name} check`; bonus = skill.value; }
    if (!label) return { error: "That isn't a check this character can roll" };
    return { text: `${label}: ${rollToHit(bonus, rng).total}`, critKey: null };
}
