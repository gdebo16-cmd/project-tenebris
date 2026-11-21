import { test } from 'node:test';
import assert from 'node:assert/strict';
import { characterToCreature, type SheetData } from '../src/creature.ts';
import { checkActRequest, resolveAct } from '../src/actions.ts';
import { fixedDice } from './helpers.ts';

const data: SheetData = {
    character: {
        id: 1, name: 'Brann', level: 11, max_hp: 40, current_hp: 40,
        str: 16, dex: 14, con: 14, int: 18, wis: 10, cha: 18, spd: 10, luc: 10,
        spell_stat: 'str', casting_stat: 'int', class_name: 'Reaver', race_base_speed: 30,
    },
    ownedWeapons: [
        { id: 10, name: 'Glaive', is_equipped: true, category: 'melee', damage_dice: '1d10', properties: ['two-handed'], soul_branded: true,
          runes: [{ id: 1, name: 'Ember Rune', dice: '1d4', is_damage_rider: true }] },
    ],
    learnedSpells: [
        { id: 7, name: 'Arc Bolts', base_level: 0, is_action: true, is_prepared: true, attack_type: 'ranged', base_damage_dice: '1d10', beam_scaling: [{ level: 5, beams: 2 }] },
        { id: 8, name: 'Fire Lance', base_level: 1, is_action: true, is_prepared: true, attack_type: 'ranged', base_damage_dice: '2d6', upcasts: [{ cast_level: 2, damage_dice: '3d6' }] },
        { id: 9, name: 'Mend', base_level: 1, is_action: true, is_prepared: true, heal_dice: '1d8', heal_add_mod: true },
    ],
};
const creature = characterToCreature(data);

test('the request carries names only', () => {
    assert.ok('request' in checkActRequest({ actionKey: 'w10', kind: 'hit' }));
    for (const bad of [null, {}, { actionKey: 'w10' }, { actionKey: 'w10', kind: 'nuke' }, { actionKey: 'w10', kind: 'hit', castLevel: 12 }, { actionKey: 'w10', kind: 'damage', extra: 'triple' }]) {
        assert.ok('error' in checkActRequest(bad), JSON.stringify(bad));
    }
});

test('weapon to-hit uses the server-side bonus and remembers a natural 20', () => {
    const glaive = creature.actions.find((a) => a.key === 'w10')!;
    assert.deepEqual(resolveAct(creature, { actionKey: 'w10', kind: 'hit' }, null, fixedDice(12)), { text: `Chance to hit: ${12 + glaive.hit}`, critKey: null });
    assert.deepEqual(resolveAct(creature, { actionKey: 'w10', kind: 'hit' }, null, fixedDice(20)), { text: `Chance to hit: ${20 + glaive.hit} CRIT!`, critKey: 'w10' });
});

test('weapon damage: riders, and a remembered crit doubles the dice', () => {
    // no crit: d10 = 6, Ember d4 = 3; CHA mod 4 on the branded glaive
    assert.deepEqual(resolveAct(creature, { actionKey: 'w10', kind: 'damage' }, null, fixedDice(6, 3)), { text: 'Damage dealt: 10 + 3 fire = 13', critKey: null });
    // crit: two d10 (6, 5) and two d4 (1, 2)
    assert.deepEqual(resolveAct(creature, { actionKey: 'w10', kind: 'damage' }, 'w10', fixedDice(6, 5, 1, 2)), { text: 'Damage dealt: 15 + 3 fire = 18 CRIT!', critKey: null });
});

test('Soul Strike adds its dice only on the branded weapon', () => {
    const r = resolveAct(creature, { actionKey: 'w10', kind: 'damage', extra: 'soulStrike' }, null, fixedDice(6, 3, 4, 5));
    assert.deepEqual(r, { text: 'Damage dealt: 10 + 3 fire + Soul Strike 9 force = 22 (spend 1 Temper)', critKey: null });   // 2d8 at level 11
    assert.ok('error' in resolveAct(creature, { actionKey: 'fists', kind: 'damage', extra: 'soulStrike' }, null, fixedDice(1)));
    assert.ok('error' in resolveAct(creature, { actionKey: 'w10', kind: 'damage', extra: 'runicStrike' }, null, fixedDice(1)));
});

test('spells: beams, upcasts, heals, and things a spell cannot do', () => {
    const bolts = resolveAct(creature, { actionKey: 's7', kind: 'hit' }, null, fixedDice(10, 4, 10, 4));
    assert.ok('text' in bolts && bolts.text.startsWith('Beam 1: to hit') && bolts.text.includes('Beam 2'));
    assert.deepEqual(resolveAct(creature, { actionKey: 's8', kind: 'damage', castLevel: 2 }, null, fixedDice(1, 2, 3)), { text: 'Damage dealt: 6', critKey: null });   // 3d6 upcast
    assert.deepEqual(resolveAct(creature, { actionKey: 's9', kind: 'heal' }, null, fixedDice(5)), { text: 'Healed: 9', critKey: null });   // 1d8 + INT 4
    assert.ok('error' in resolveAct(creature, { actionKey: 's9', kind: 'hit' }, null, fixedDice(5)));
    assert.ok('error' in resolveAct(creature, { actionKey: 's8', kind: 'damage', castLevel: 0 }, null, fixedDice(5)));
    assert.ok('error' in resolveAct(creature, { actionKey: 'w999', kind: 'hit' }, null, fixedDice(5)));
});
