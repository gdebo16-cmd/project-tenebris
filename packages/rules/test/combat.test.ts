import { test } from 'node:test';
import assert from 'node:assert/strict';
import { characterToCreature, type SheetData } from '../src/creature.ts';
import { checkTableAct, resolveTableAct, reachFt, outcomeLine, actChoices, type Placed } from '../src/combat.ts';
import { canSee, areaHexes, visibleFrom, checkArea, hexLine } from '../src/sight.ts';
import { hexKey } from '../src/board.ts';
import { fixedDice } from './helpers.ts';

// ---- sight and areas ----

test('hexLine runs from one hex to another', () => {
    const line = hexLine({ q: 0, r: 0 }, { q: 3, r: 0 });
    assert.deepEqual(line.map(hexKey), ['0,0', '1,0', '2,0', '3,0']);
});

test('canSee: a wall in between blocks, one beside the line does not', () => {
    const wall = new Set(['1,0']);
    assert.equal(canSee({ q: 0, r: 0 }, { q: 2, r: 0 }, wall), false);
    assert.equal(canSee({ q: 0, r: 0 }, { q: 0, r: 2 }, wall), true);
    assert.equal(canSee({ q: 0, r: 0 }, { q: 1, r: 0 }, wall), true);       // you see the wall itself
});

test('visibleFrom stops at walls', () => {
    const seen = visibleFrom([{ q: 0, r: 0 }], new Set(['1,0']), 3);
    assert.ok(seen.has('1,0'));
    assert.ok(!seen.has('3,0'));
    assert.ok(seen.has('-3,0'));
});

test('areas: circle, square, cone and line', () => {
    const from = { q: 0, r: 0 };
    assert.equal(areaHexes({ kind: 'circle', at: { q: 4, r: 0 }, sizeFt: 5 }, from).length, 7);    // a hex and its 6 neighbours
    assert.equal(areaHexes({ kind: 'line', at: { q: 1, r: 0 }, sizeFt: 20 }, from).length, 4);     // 4 hexes, caster left out
    const cone = areaHexes({ kind: 'cone', at: { q: 1, r: 0 }, sizeFt: 15 }, from);
    assert.ok(cone.length >= 4 && !cone.some((h) => h.q === 0 && h.r === 0));
    assert.ok(cone.every((h) => h.q > 0));                                                         // it points the right way
    assert.ok(areaHexes({ kind: 'square', at: from, sizeFt: 15 }, from).length >= 7);
    assert.ok('error' in checkArea({ kind: 'blob', at: from, sizeFt: 10 }));
    assert.ok('error' in checkArea({ kind: 'circle', at: from, sizeFt: 7 }));
});

// ---- resolving actions ----

const sheet = (id: number, name: string, extra: Partial<SheetData['character']> = {}): SheetData => ({
    character: { id, name, level: 5, max_hp: 30, current_hp: 30, str: 16, dex: 14, con: 14, int: 16, wis: 10, cha: 10, spd: 10, luc: 10,
        spell_stat: 'str', casting_stat: 'int', class_name: 'Reaver', race_base_speed: 30, spell_slots: [4, 2], class_saving_throws: ['DEX'], ...extra },
    ownedWeapons: [
        { id: 10, name: 'Sword', is_equipped: true, category: 'melee', damage_dice: '1d8' },
        { id: 11, name: 'Bow', is_equipped: true, category: 'ranged', damage_dice: '1d6', range_normal: 80, range_long: 320 },
    ],
    learnedSpells: [
        { id: 20, name: 'Blaze', base_level: 1, is_action: true, is_prepared: true, opponent_save_roll: 'DEX', base_damage_dice: '2d6', range: 60 },
        { id: 21, name: 'Mend', base_level: 1, is_action: true, is_prepared: true, heal_dice: '1d8', range: 5 },
        { id: 22, name: 'Glow', base_level: 0, is_action: true, is_prepared: true, range: 30 },
    ],
});
const hero = characterToCreature(sheet(1, 'Bram'));
const foe = characterToCreature(sheet(2, 'Hound'));
const me: Placed & { creature: typeof hero } = { tokenId: 1, hex: { q: 0, r: 0 }, name: 'Bram', creature: hero };
const near: Placed = { tokenId: 2, hex: { q: 1, r: 0 }, name: 'Hound', creature: foe };
const far: Placed = { tokenId: 3, hex: { q: 6, r: 0 }, name: 'Wolf', creature: foe };
const ac = foe.armorClass.value;
const sword = hero.actions.find((a) => a.name === 'Sword')!;

test('the request: a target or an area, never both', () => {
    assert.ok('request' in checkTableAct({ actionKey: 'w10', target: 2 }));
    assert.ok('request' in checkTableAct({ actionKey: 's20', area: { kind: 'circle', at: { q: 2, r: 0 }, sizeFt: 10 } }));
    for (const bad of [{}, { actionKey: 'w10' }, { actionKey: 'w10', target: 2, area: { kind: 'circle', at: { q: 0, r: 0 }, sizeFt: 5 } }, { actionKey: 'w10', target: 'x' }]) {
        assert.ok('error' in checkTableAct(bad), JSON.stringify(bad));
    }
});

test('reachFt reads weapon ranges', () => {
    assert.equal(reachFt('80/320 ft'), 320);
    assert.equal(reachFt('10 ft (reach)'), 10);
    assert.equal(reachFt('5 ft'), 5);
});

test('a weapon hits when the roll beats the armour, and the damage is rolled', () => {
    const needed = ac - sword.hit;                       // the natural roll that just hits
    const hit = resolveTableAct(me, { actionKey: sword.key, target: 2, keepTurns: 0 }, [me, near], new Set(), fixedDice(needed, 5));
    assert.ok(!('error' in hit));
    assert.equal(hit.outcomes[0].result, 'hit');
    assert.equal(hit.outcomes[0].damage, 5 + sword.dmgMod);
    const miss = resolveTableAct(me, { actionKey: sword.key, target: 2, keepTurns: 0 }, [me, near], new Set(), fixedDice(needed - 1));
    assert.ok(!('error' in miss));
    assert.equal(miss.outcomes[0].result, 'miss');
    assert.equal(miss.outcomes[0].damage, 0);
});

test('a natural 20 hits and doubles the dice; a natural 1 misses', () => {
    const crit = resolveTableAct(me, { actionKey: sword.key, target: 2, keepTurns: 0 }, [me, near], new Set(), fixedDice(20, 4, 3));
    assert.ok(!('error' in crit));
    assert.equal(crit.outcomes[0].damage, 7 + sword.dmgMod);
    assert.equal(crit.outcomes[0].crit, true);
    const fumble = resolveTableAct(me, { actionKey: sword.key, target: 2, keepTurns: 0 }, [me, near], new Set(), fixedDice(1));
    assert.ok(!('error' in fumble));
    assert.equal(fumble.outcomes[0].result, 'miss');
});

test('range and sight are enforced before any dice', () => {
    const tooFar = resolveTableAct(me, { actionKey: sword.key, target: 3, keepTurns: 0 }, [me, far], new Set(), fixedDice());
    assert.ok('error' in tooFar && /30 ft away/.test(tooFar.error));
    const bow = hero.actions.find((a) => a.name === 'Bow')!;
    const blocked = resolveTableAct(me, { actionKey: bow.key, target: 3, keepTurns: 0 }, [me, far], new Set(['3,0']), fixedDice());
    assert.ok('error' in blocked && /can't see/.test(blocked.error));
});

test('a save spell: a fail takes the damage, a success takes none; the slot is spent', () => {
    const blaze = hero.spells.find((s) => s.name === 'Blaze')!;
    const area = { kind: 'circle' as const, at: { q: 3, r: 0 }, sizeFt: 10 };
    const a: Placed = { tokenId: 4, hex: { q: 3, r: 0 }, name: 'A', creature: foe };
    const b: Placed = { tokenId: 5, hex: { q: 4, r: 0 }, name: 'B', creature: foe };
    // damage 2d6 = 3 + 4 = 7 (once for everyone); A rolls 2 (fails), B rolls 19 (saves)
    const r = resolveTableAct(me, { actionKey: blaze.key, area, keepTurns: 0 }, [me, a, b, far], new Set(), fixedDice(3, 4, 2, 19));
    assert.ok(!('error' in r));
    assert.deepEqual(r.outcomes.map((o) => [o.name, o.result, o.damage]), [['A', 'failed', 7], ['B', 'saved', 0]]);
    assert.deepEqual(r.usedSlots, { 1: 1 });
    assert.match(outcomeLine(r.outcomes[1], false), /saved, no damage/);
});

test('healing a friend, and spells the table cannot resolve', () => {
    const mend = hero.spells.find((s) => s.name === 'Mend')!;
    const r = resolveTableAct(me, { actionKey: mend.key, target: 1, keepTurns: 0 }, [me], new Set(), fixedDice(6));
    assert.ok(!('error' in r));
    assert.equal(r.outcomes[0].result, 'heal');
    assert.ok(r.outcomes[0].heal >= 6);
    assert.ok(!actChoices(hero).some((c) => c.name === 'Glow'));             // no effect: not on the Act menu
    const glow = hero.spells.find((s) => s.name === 'Glow')!;
    assert.ok('error' in resolveTableAct(me, { actionKey: glow.key, target: 2, keepTurns: 0 }, [me, near], new Set(), fixedDice()));
});
