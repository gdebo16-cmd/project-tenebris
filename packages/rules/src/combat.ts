// Step 17: resolving an action on the table. A player (or the DM) names an action and a target token or an area; the
// server works out everything else with this file: range, line of sight, the to-hit roll against the target's armour,
// the target's saving throw, the damage or healing, and the spell slot. Nothing about the dice comes from the browser.
//
// Rules (owner's calls, 2026-11-23):
//   - attacks: d20 + to-hit against the target's AC. A natural 20 always hits and doubles the damage dice; a 1 always misses.
//   - saves: the target rolls d20 + its save bonus against the caster's save DC. Success = NO damage (not half).
//   - range is enforced: out of range (or out of sight) is refused before anything is rolled or spent.
//   - damage goes straight onto the target's HP (temporary HP first); the DM can still fix HP by hand on the sheet.
import { rollDice, rollToHit, type Rng, type ToHitRoll } from './dice.ts';
import { type Hex, hexKey, distance } from './board/hex.ts';
import { canSee, areaHexes, checkArea, type Area } from './sight.ts';
import { spendSlot, type UsedSlots } from './sheetState.ts';
import { spellDiceAt, spellHealAt, type Creature, type WeaponAction, type SpellAction } from './creature.ts';
import { statKey, statName } from './stats.ts';
// ---- the request ----

// target: a token id (one target).  area: a shape (area spells).  keepTurns: leave the area on the board for that many
// of the caster's turns (0 = show it once and take it away).
export type TableAct = { actionKey: string; castLevel?: number; target?: number; area?: Area; keepTurns: number };
export const MAX_KEEP_TURNS = 100;

export function checkTableAct(body: unknown): { error: string } | { request: TableAct } {
    const b = (body ?? {}) as Record<string, unknown>;
    if (typeof b.actionKey !== 'string' || b.actionKey.length === 0 || b.actionKey.length > 60) return { error: 'Which action?' };
    const castLevel = b.castLevel == null ? undefined : Number(b.castLevel);
    if (castLevel !== undefined && (!Number.isInteger(castLevel) || castLevel < 0 || castLevel > 9)) return { error: 'castLevel must be 0 to 9' };
    const keepTurns = b.keepTurns == null ? 0 : Number(b.keepTurns);
    if (!Number.isInteger(keepTurns) || keepTurns < 0 || keepTurns > MAX_KEEP_TURNS) return { error: `keepTurns must be 0 to ${MAX_KEEP_TURNS}` };
    const hasTarget = b.target != null, hasArea = b.area != null;
    if (hasTarget === hasArea) return { error: 'Pick a target or an area (one of them)' };
    if (hasTarget) {
        if (!Number.isInteger(b.target)) return { error: 'target must be a token id' };
        return { request: { actionKey: b.actionKey, castLevel, target: b.target as number, keepTurns: 0 } };
    }
    const area = checkArea(b.area);
    if ('error' in area) return area;
    return { request: { actionKey: b.actionKey, castLevel, area: area.area, keepTurns } };
}

// ---- what an action can reach ----

// A weapon's range text ("80/320 ft", "10 ft (reach)", "5 ft") as feet: how far it reaches at most
export function reachFt(range: string | null | undefined): number {
    const m = String(range ?? '').match(/(\d+)\s*(?:\/\s*(\d+))?/);
    if (!m) return 5;
    return Number(m[2] ?? m[1]) || 5;
}

// A spell's range in feet. 0 = self; none given = touch (5 ft).
export function spellRangeFt(spell: SpellAction): number {
    const r = spell.range;
    if (r == null || r === '') return 5;
    const n = Number(r);
    return Number.isFinite(n) && n >= 0 ? n : 5;
}

// What the table's Act menu shows for one creature: each action, how far it reaches, and whether it can target an area
export type ActChoice = {
    key: string; name: string; kind: 'weapon' | 'spell'; rangeFt: number;
    area: boolean;                    // spells can be cast on an area; weapons hit one target
    heals: boolean;                   // a healing spell (pick a friend)
    baseLevel: number | null;         // spells: the lowest level it can be cast at (null for weapons)
    detail: string;                   // a short line: "to hit +5, 1d8+3" / "DEX save, 8d6"
};
export function actChoices(c: Creature): ActChoice[] {
    const weapons = [...c.actions, ...c.bonusActions].map((a): ActChoice => ({
        key: a.key, name: a.name, kind: 'weapon', rangeFt: reachFt(a.range), area: false, heals: false, baseLevel: null,
        detail: `to hit ${a.hit >= 0 ? '+' : ''}${a.hit}, ${a.dice}${a.dmgMod ? (a.dmgMod > 0 ? `+${a.dmgMod}` : a.dmgMod) : ''}`,
    }));
    const spells = c.spells.filter(hasTableEffect).map((s): ActChoice => {
        const heal = !s.attack_type && !s.opponent_save_roll && !spellDiceAt(s, s.base_level) && !!spellHealAt(s, s.base_level);
        const how = s.attack_type ? `to hit +${s.toHit}` : s.opponent_save_roll ? `${statName(s.opponent_save_roll)} save` : heal ? 'heals' : 'always hits';
        const dice = heal ? spellHealAt(s, s.base_level) : spellDiceAt(s, s.base_level);
        return { key: s.key, name: s.name, kind: 'spell', rangeFt: spellRangeFt(s), area: true, heals: heal, baseLevel: s.base_level, detail: `${how}${dice ? `, ${dice}` : ''}` };
    });
    return [...weapons, ...spells];
}

// A spell the table can resolve: it attacks, asks for a save, deals damage or heals
const hasTableEffect = (s: SpellAction) =>
    !!(s.attack_type || s.opponent_save_roll || spellDiceAt(s, s.base_level) || spellHealAt(s, s.base_level));

// ---- resolving ----

// A token on the board: where it is and its sheet (null for summons, which have no sheet yet)
export type Placed = { tokenId: number; hex: Hex; name: string; creature: Creature | null };

export type Outcome = {
    tokenId: number; name: string;
    result: 'hit' | 'miss' | 'saved' | 'failed' | 'damage' | 'heal';
    toHit: { natural: number; total: number } | null;      // attacks
    save: { stat: string; natural: number; total: number; dc: number } | null;   // saves
    crit: boolean;
    damage: number;                                         // taken off HP (temporary HP first)
    heal: number;                                           // added to HP (up to max)
    beams: { hit: boolean; total: number }[] | null;        // multi-beam spells: each beam's roll
};
export type ActResolved = {
    actionName: string; kind: 'weapon' | 'spell'; castLevel: number | null;
    usedSlots: UsedSlots | null;                            // the caster's new spent slots (null = nothing spent)
    area: Hex[] | null;                                     // the hexes an area covered
    outcomes: Outcome[];
};

const blank = (p: Placed): Outcome => ({ tokenId: p.tokenId, name: p.name, result: 'damage', toHit: null, save: null, crit: false, damage: 0, heal: 0, beams: null });
const beats = (r: ToHitRoll, ac: number) => !r.fail && (r.crit || r.total >= ac);

export function resolveTableAct(
    actor: Placed & { creature: Creature }, request: TableAct, everyone: Placed[], blockers: Set<string>, rng: Rng,
): { error: string } | ActResolved {
    const me = actor.creature;
    const weapon = [...me.actions, ...me.bonusActions].find((a) => a.key === request.actionKey);
    const spell = weapon ? undefined : me.spells.find((s) => s.key === request.actionKey);
    if (!weapon && !spell) return { error: `That isn't one of ${me.name}'s actions` };

    // ---- who is in reach (checked before anything is rolled or spent) ----
    let targets: Placed[];
    let area: Hex[] | null = null;
    const rangeFt = weapon ? reachFt(weapon.range) : spellRangeFt(spell!);
    const name = weapon?.name ?? spell!.name;

    if (request.target != null) {
        const t = everyone.find((p) => p.tokenId === request.target);
        if (!t) return { error: "That token isn't on this scene" };
        if (!t.creature) return { error: `${t.name} has no sheet to roll against` };
        const heals = spell && isHealSpell(spell, request.castLevel ?? spell.base_level);
        if (t.tokenId === actor.tokenId && !heals) return { error: "You can't attack yourself" };
        const feet = distance(actor.hex, t.hex) * 5;
        if (feet > Math.max(rangeFt, 5)) return { error: `${t.name} is ${feet} ft away; ${name} reaches ${rangeFt} ft` };
        if (!canSee(actor.hex, t.hex, blockers)) return { error: `${me.name} can't see ${t.name} from there` };
        targets = [t];
    } else {
        if (!spell) return { error: `${name} hits one target; pick a token` };
        const a = request.area!;
        if (a.kind === 'circle' || a.kind === 'square') {
            const feet = distance(actor.hex, a.at) * 5;
            if (rangeFt === 0 && feet > 0) return { error: `${name} centres on the caster` };
            if (feet > rangeFt) return { error: `That spot is ${feet} ft away; ${name} reaches ${rangeFt} ft` };
            if (!canSee(actor.hex, a.at, blockers)) return { error: `${me.name} can't see that spot` };
        } else if (a.at.q === actor.hex.q && a.at.r === actor.hex.r) {
            return { error: 'Point the cone or line away from the caster' };
        }
        area = areaHexes(a, actor.hex);
        const inside = new Set(area.map(hexKey));
        targets = everyone.filter((p) => p.creature && inside.has(hexKey(p.hex)));
    }

    // ---- weapons ----
    if (weapon) return { actionName: weapon.name, kind: 'weapon', castLevel: null, usedSlots: null, area: null, outcomes: targets.map((t) => weaponAttack(weapon, t, rng)) };

    // ---- spells: the level and the slot ----
    const s = spell!;
    const level = request.castLevel ?? s.base_level;
    if (level < s.base_level) return { error: `${s.name} can't be cast below level ${s.base_level}` };
    if (s.base_level === 0 && level !== 0) return { error: `${s.name} is a cantrip` };
    if (!hasTableEffect(s)) return { error: `${s.name} has no effect the table can work out yet; cast it from the sheet` };
    let usedSlots: UsedSlots | null = null;
    if (me.kind === 'character' && level > 0) {
        const spent = spendSlot(me.spellcasting.slots, me.spellcasting.usedSlots, level);
        if ('error' in spent) return spent;
        usedSlots = spent.usedSlots;
    }

    const dice = spellDiceAt(s, level);
    const dmgMod = s.dmgMod ?? 0;
    const outcomes: Outcome[] = [];

    if (s.attack_type) {
        // an attack spell: every target is rolled against separately
        for (const t of targets) outcomes.push(spellAttack(s, dice, dmgMod, t, rng));
    } else if (s.opponent_save_roll) {
        // a save spell: one damage roll for everyone; each target that fails takes it, a success takes none
        const damage = dice ? Math.max(0, rollDice(dice, rng).total + dmgMod) : 0;
        const stat = statKey(s.opponent_save_roll);
        for (const t of targets) {
            const save = rollToHit(stat ? (t.creature!.saves[stat] ?? 0) : 0, rng);
            const saved = save.total >= s.saveDc;
            outcomes.push({ ...blank(t), result: saved ? 'saved' : 'failed', damage: saved ? 0 : damage,
                save: { stat: statName(s.opponent_save_roll), natural: save.natural, total: save.total, dc: s.saveDc } });
        }
    } else if (dice) {
        // damage that always lands
        const damage = Math.max(0, rollDice(dice, rng).total + dmgMod);
        for (const t of targets) outcomes.push({ ...blank(t), result: 'damage', damage });
    } else {
        // healing (never crits)
        const heal = Math.max(0, rollDice(spellHealAt(s, level), rng).total + s.healMod);
        for (const t of targets) outcomes.push({ ...blank(t), result: 'heal', heal });
    }
    return { actionName: s.name, kind: 'spell', castLevel: level, usedSlots, area, outcomes };
}

const isHealSpell = (s: SpellAction, level: number) => !s.attack_type && !s.opponent_save_roll && !spellDiceAt(s, level) && !!spellHealAt(s, level);

function weaponAttack(a: WeaponAction, t: Placed, rng: Rng): Outcome {
    const r = rollToHit(a.hit, rng);
    const out: Outcome = { ...blank(t), toHit: { natural: r.natural, total: r.total }, crit: r.crit };
    if (!beats(r, t.creature!.armorClass.value)) return { ...out, result: 'miss' };
    const base = Math.max(0, rollDice(a.dice, rng, r.crit).total + a.dmgMod);
    const riders = a.riders.reduce((sum, x) => sum + rollDice(x.dice, rng, r.crit).total, 0);
    return { ...out, result: 'hit', damage: base + riders };
}

function spellAttack(s: SpellAction, dice: string | null, dmgMod: number, t: Placed, rng: Rng): Outcome {
    const ac = t.creature!.armorClass.value;
    if (s.beams > 1) {
        // several beams: each rolls to hit on its own, and each that hits deals its own damage
        const beams = Array.from({ length: s.beams }, () => {
            const r = rollToHit(s.toHit, rng);
            const hit = beats(r, ac);
            return { hit, total: r.total, damage: hit && dice ? Math.max(0, rollDice(dice, rng, r.crit).total + dmgMod) : 0, crit: r.crit && hit };
        });
        const damage = beams.reduce((sum, b) => sum + b.damage, 0);
        return { ...blank(t), result: beams.some((b) => b.hit) ? 'hit' : 'miss', damage, crit: beams.some((b) => b.crit),
            beams: beams.map(({ hit, total }) => ({ hit, total })) };
    }
    const r = rollToHit(s.toHit, rng);
    const out: Outcome = { ...blank(t), toHit: { natural: r.natural, total: r.total }, crit: r.crit };
    if (!beats(r, ac)) return { ...out, result: 'miss' };
    return { ...out, result: 'hit', damage: dice ? Math.max(0, rollDice(dice, rng, r.crit).total + dmgMod) : 0 };
}

// ---- telling the table ----

// One line per target for the table's feed. numbers: show roll totals. The server sends the DM every number, and
// players everything except a monster's own rolls (its to-hit and saves), so no monster bonus leaks out.
export function outcomeLine(o: Outcome, numbers: boolean): string {
    const roll = (n: number) => (numbers ? ` (${n})` : '');
    const crit = o.crit ? ' CRIT!' : '';
    switch (o.result) {
        case 'hit': return `${o.name}: hit${o.toHit ? roll(o.toHit.total) : ''}${crit}, ${o.damage} damage${beamText(o, numbers)}`;
        case 'miss': return `${o.name}: miss${o.toHit ? roll(o.toHit.total) : ''}${beamText(o, numbers)}`;
        case 'saved': return `${o.name}: saved${roll(o.save!.total)}, no damage`;
        case 'failed': return `${o.name}: failed the ${o.save!.stat} save${roll(o.save!.total)}, ${o.damage} damage`;
        case 'damage': return `${o.name}: ${o.damage} damage`;
        case 'heal': return `${o.name}: healed ${o.heal}`;
    }
}
const beamText = (o: Outcome, numbers: boolean) =>
    o.beams ? ` [${o.beams.map((b) => (b.hit ? 'hit' : 'miss') + (numbers ? ` ${b.total}` : '')).join(', ')}]` : '';
