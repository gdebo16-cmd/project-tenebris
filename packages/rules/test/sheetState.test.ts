import { test } from 'node:test';
import assert from 'node:assert/strict';
import { characterToCreature, type SheetData } from '../src/creature.ts';
import { spendFeatureUse, takeRest, checkRestRequest, spendSlot, castSpell, checkCastRequest, checkConditionsRequest, applyConditions, type RestInput } from '../src/sheetState.ts';
import { fixedDice } from './helpers.ts';

// Real feature rows from the content pack: Reseal (2 per short rest, 3 from level 13, 1d6) and
// Sentence Passed (1 per long rest, 6d8)
const reseal = { source: 'class', id: 21, name: 'Reseal', action_type: 'bonus', dice: '1d6', rest_uses: 2, rest_lock: 'short', uses_scaling: [{ uses: 3, level: 13 }] };
const sentence = { source: 'subclass', id: 40, name: 'Sentence Passed', action_type: 'action', dice: '6d8', rest_uses: 1, rest_lock: 'long', uses_scaling: null };
const sigil = { source: 'class', id: 5, name: 'Rally', action_type: 'bonus', dice: null, rest_uses: null };

const make = (extra: Partial<SheetData['character']> = {}, level = 5): SheetData => ({
    character: {
        id: 1, name: 'Vex', level, max_hp: 40, current_hp: 40,
        str: 10, dex: 14, con: 12, int: 16, wis: 10, cha: 12, spd: 10, luc: 10,
        spell_stat: 'int', casting_stat: 'int', class_name: 'Mage', spell_slots: [2, 1],
        ...extra,
    },
    learnedSpells: [
        { id: 7, name: 'Spark', base_level: 0, is_action: true, is_prepared: true, attack_type: 'ranged', base_damage_dice: '1d10' },
        { id: 8, name: 'Fire Lance', base_level: 1, is_action: true, is_prepared: true, attack_type: 'ranged', base_damage_dice: '2d6', upcasts: [{ cast_level: 2, damage_dice: '3d6' }] },
        { id: 9, name: 'Mend', base_level: 1, is_action: true, is_prepared: true, heal_dice: '1d8', heal_add_mod: true },
        { id: 10, name: 'Frost Wave', base_level: 1, is_action: true, is_prepared: true, opponent_save_roll: 'CON', base_damage_dice: '2d8' },
    ],
    actionFeatures: [reseal, sentence, sigil],
});

test('the Creature shows uses left per feature, with level scaling', () => {
    const c = characterToCreature(make({ rest_uses: { 'class-21': 1 } }));
    const r = c.features.find((f) => f.key === 'class-21')!;
    assert.deepEqual(r.perRest, { max: 2, used: 1, left: 1, rest: 'short' });
    assert.equal(r.diceNow, '1d6');
    assert.equal(c.features.find((f) => f.key === 'class-5')!.perRest, null);
    assert.equal(characterToCreature(make({}, 13)).features.find((f) => f.key === 'class-21')!.perRest!.max, 3);
});

test('using a feature spends one use and rolls its dice on the server', () => {
    const c = characterToCreature(make({ rest_uses: { 'class-21': 1 } }));
    assert.deepEqual(spendFeatureUse(c, 'class-21', fixedDice(4)), { text: 'Vex uses Reseal [0/2 uses left]! Rolled 1d6: 4', restUses: { 'class-21': 2 } });
    const out = spendFeatureUse(characterToCreature(make({ rest_uses: { 'class-21': 2 } })), 'class-21', fixedDice(4));
    assert.ok('error' in out && out.error.includes('no uses left (2/2) until your next short rest'));
});

test('a feature with no uses and no dice, or someone else\'s feature, is refused', () => {
    const c = characterToCreature(make());
    assert.ok('error' in spendFeatureUse(c, 'class-5', fixedDice()));
    assert.ok('error' in spendFeatureUse(c, 'class-999', fixedDice()));
});

const restInput: RestInput = {
    hp: { current: 10, max: 40, temp: 5 },
    usedSlots: { 1: 2, 2: 1 },
    conditions: { blind: true, bleed: true, deaf: false },
    exhaustion: 3,
    restUses: { 'class-21': 2, 'subclass-40': 1, 'rune-3': 1, 'body-9': 1 },
    features: [reseal, sentence],
};

test('a long rest restores everything and rolls nothing', () => {
    assert.deepEqual(takeRest('long', restInput, fixedDice()), {
        percent: 100, heal: 30, clearTemp: true,
        usedSlots: { 1: 0, 2: 0 },
        conditions: { blind: false, bleed: false, deaf: false },
        exhaustion: 0, restUses: {},
        text: 'Long Rest: fully restored!',
    });
});

test('a short rest: 1d41+19 percent back, conditions roll to wear off, only short-rest uses return', () => {
    // 1d41 = 21 -> 40%; blind rolls 55 (beats 40, stays), bleed rolls 12 (wears off)
    assert.deepEqual(takeRest('short', restInput, fixedDice(21, 55, 12)), {
        percent: 40, heal: 12, clearTemp: false,
        usedSlots: { 1: 1, 2: 1 },          // 2 - round(0.8) = 1, 1 - round(0.4) = 1
        conditions: { blind: true, bleed: false, deaf: false },
        exhaustion: 2,                      // 3 - round(1.2)
        restUses: { 'subclass-40': 1, 'rune-3': 1, 'body-9': 1 },
        text: 'Short rest: restored 40%',
    });
});

test('the rest request is only short or long', () => {
    assert.deepEqual(checkRestRequest({ type: 'short' }), { type: 'short' });
    for (const bad of [null, {}, { type: 'nap' }]) assert.ok('error' in checkRestRequest(bad));
});

test('slots: spend one at a level, cantrips are free, none left is refused', () => {
    assert.deepEqual(spendSlot([2, 1], {}, 1), { usedSlots: { 1: 1 } });
    assert.deepEqual(spendSlot([2, 1], { 1: 1 }, 0), { usedSlots: { 1: 1 } });
    assert.deepEqual(spendSlot([2, 1], { 2: 1 }, 2), { error: 'No level 2 slots left!' });
    assert.deepEqual(spendSlot([2, 1], {}, 3), { error: 'No level 3 slots left!' });
});

test('casting spends the slot on the server and rolls the spell', () => {
    const c = characterToCreature(make({ used_slots: { 1: 1 } }));
    const lance = c.spells.find((s) => s.key === 's8')!;
    assert.deepEqual(castSpell(c, { actionKey: 's8' }, fixedDice(12)), { text: `Vex casts Fire Lance! Chance to hit: ${12 + lance.toHit}`, critKey: null, usedSlots: { 1: 2 } });
    assert.deepEqual(castSpell(c, { actionKey: 's8', castLevel: 2 }, fixedDice(20)), { text: `Vex casts Fire Lance at level 2! Chance to hit: ${20 + lance.toHit} CRIT!`, critKey: 's8', usedSlots: { 1: 1, 2: 1 } });
    assert.deepEqual(castSpell(c, { actionKey: 's9' }, fixedDice(5)), { text: 'Vex casts Mend! Healed: 8', critKey: null, usedSlots: { 1: 2 } });   // 1d8 + INT 3
    assert.deepEqual(castSpell(c, { actionKey: 's10' }, fixedDice()), { text: `Vex casts Frost Wave! Target makes a Endurance roll against ${c.spellcasting.saveDc}.`, critKey: null, usedSlots: { 1: 2 } });
    // a cantrip spends nothing
    const spark = castSpell(c, { actionKey: 's7' }, fixedDice(3));
    assert.ok('usedSlots' in spark && spark.usedSlots === c.spellcasting.usedSlots);
});

test('a refused cast spends nothing', () => {
    const full = characterToCreature(make({ used_slots: { 1: 2, 2: 1 } }));
    assert.deepEqual(castSpell(full, { actionKey: 's8' }, fixedDice()), { error: 'No level 1 slots left!' });
    const c = characterToCreature(make());
    assert.ok('error' in castSpell(c, { actionKey: 's8', castLevel: 0 }, fixedDice()));
    assert.ok('error' in castSpell(c, { actionKey: 's7', castLevel: 1 }, fixedDice()));
    assert.ok('error' in castSpell(c, { actionKey: 'w1' }, fixedDice()));
});

test('the cast request carries names and a level only', () => {
    assert.deepEqual(checkCastRequest({ actionKey: 's8', castLevel: 2 }), { request: { actionKey: 's8', castLevel: 2 } });
    for (const bad of [null, {}, { actionKey: '' }, { actionKey: 's8', castLevel: 12 }, { actionKey: 's8', castLevel: 1.5 }]) assert.ok('error' in checkCastRequest(bad));
});

test('conditions: only known names, true or false; exhaustion 0 to 10', () => {
    assert.deepEqual(checkConditionsRequest({ conditions: { blind: true } }), { request: { conditions: { blind: true } } });
    assert.deepEqual(checkConditionsRequest({ exhaustion: 3 }), { request: { exhaustion: 3 } });
    assert.deepEqual(checkConditionsRequest({ conditions: { sleep: false }, exhaustion: 0 }), { request: { conditions: { sleep: false }, exhaustion: 0 } });
    assert.deepEqual(checkConditionsRequest({}), { error: 'Change a condition or exhaustion' });
    assert.deepEqual(checkConditionsRequest({ conditions: { flying: true } }), { error: 'There is no condition called "flying"' });
    assert.deepEqual(checkConditionsRequest({ conditions: { blind: 'yes' } }), { error: 'blind must be true or false' });
    assert.ok('error' in checkConditionsRequest({ conditions: ['blind'] }));
    for (const bad of [-1, 11, 2.5, '3']) assert.ok('error' in checkConditionsRequest({ exhaustion: bad }), String(bad));
});

test('conditions: a change keeps the conditions it does not name', () => {
    const now = { conditions: { blind: true, deaf: true }, exhaustion: 2 };
    assert.deepEqual(applyConditions(now, { conditions: { deaf: false, bleed: true } }), { conditions: { blind: true, deaf: false, bleed: true }, exhaustion: 2 });
    assert.deepEqual(applyConditions(now, { exhaustion: 5 }), { conditions: { blind: true, deaf: true }, exhaustion: 5 });
});
