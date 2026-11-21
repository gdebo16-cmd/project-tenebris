import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    wielderPowers, weaponOptions, checkEquipRequest, checkWeaponToggle, runeChoices, checkRuneRequest, ITEM_SLOTS,
    type RuneInfo, type ItemRune,
} from '../src/equipment.ts';
import type { SheetWeapon } from '../src/creature.ts';

const fighter = { role: 'Warrior', calling: null, level: 5 };
const reaver = { role: 'Reaver', calling: null, level: 5 };
const wraith = { role: 'Wraith', calling: null, level: 5 };
const weaver = (level: number) => ({ role: 'Mage', calling: 'Rune Weaver', level });
const sword = (w: Partial<SheetWeapon> = {}): SheetWeapon => ({ id: 7, name: 'Longsword', is_equipped: true, properties: ['versatile'], versatile_dice: '1d10', ...w });

test('powers: Reaver brands, Wraith marks, Rune Weaver (or Tome of Inscription) inscribes from level 3', () => {
    assert.deepEqual(wielderPowers(fighter), { soulBrand: false, sigilMark: false, runes: false });
    assert.equal(wielderPowers(reaver).soulBrand, true);
    assert.equal(wielderPowers(wraith).sigilMark, true);
    assert.equal(wielderPowers(weaver(2)).runes, false);
    assert.equal(wielderPowers(weaver(3)).runes, true);
    assert.equal(wielderPowers({ role: 'Mage', calling: 'Tome of Inscription', level: 3 }).runes, true);
    assert.equal(ITEM_SLOTS, 3);
});

test('weapon options: only when equipped; dual wield for one-handed, two hands for versatile, never both on', () => {
    assert.deepEqual(weaponOptions(reaver, sword({ is_equipped: false })), { dualWield: null, twoHands: null, soulBrand: null, sigilMark: null, runes: false });
    assert.deepEqual(weaponOptions(fighter, sword()), { dualWield: false, twoHands: false, soulBrand: null, sigilMark: null, runes: false });
    assert.deepEqual(weaponOptions(fighter, sword({ two_handed: true })).twoHands, true);
    // Dual wielding wins over two hands, as on the old sheet
    assert.deepEqual(weaponOptions(fighter, sword({ dual_wield: true, two_handed: true })), { dualWield: true, twoHands: false, soulBrand: null, sigilMark: null, runes: false });
    // A two-handed weapon offers neither
    const greataxe = sword({ properties: ['two-handed', 'heavy'], versatile_dice: null });
    assert.deepEqual(weaponOptions(fighter, greataxe), { dualWield: null, twoHands: null, soulBrand: null, sigilMark: null, runes: false });
    // A plain one-handed weapon: dual wield only
    assert.deepEqual(weaponOptions(fighter, sword({ properties: ['light'], versatile_dice: null })).twoHands, null);
    assert.equal(weaponOptions(reaver, sword({ soul_branded: true })).soulBrand, true);
    assert.equal(weaponOptions(wraith, sword()).sigilMark, false);
    assert.equal(weaponOptions(weaver(3), sword()).runes, true);
});

test('equip requests need a catalog id; toggles need true or false', () => {
    assert.deepEqual(checkEquipRequest('weapon', { weapon_id: 7 }), { id: 7 });
    assert.deepEqual(checkEquipRequest('armor', { armor_id: 3 }), { id: 3 });
    assert.deepEqual(checkEquipRequest('item', { item_id: 12 }), { id: 12 });
    for (const bad of [undefined, 0, -1, 1.5, '7', null]) assert.ok('error' in checkEquipRequest('weapon', { weapon_id: bad }), String(bad));
    assert.ok('error' in checkEquipRequest('armor', { weapon_id: 3 }));
    assert.deepEqual(checkWeaponToggle('dual-wield', { weapon_id: 7, dual_wield: true }), { id: 7, on: true });
    assert.deepEqual(checkWeaponToggle('two-hands', { weapon_id: 7, two_handed: false }), { id: 7, on: false });
    assert.deepEqual(checkWeaponToggle('soul-brand', { weapon_id: 7, soul_branded: true }), { id: 7, on: true });
    assert.deepEqual(checkWeaponToggle('sigil-mark', { weapon_id: 7, marked: true }), { id: 7, on: true });
    assert.deepEqual(checkWeaponToggle('sigil-mark', { weapon_id: 7, marked: 'yes' }), { error: 'marked must be true or false' });
    assert.ok('error' in checkWeaponToggle('dual-wield', { dual_wield: true }));
});

const info: RuneInfo = {
    isRuneWeaver: true, level: 5, perItem: 1, active: 3, used: 0, wardingTypes: ['fire'],
    runes: [
        { id: 1, name: 'Keen', min_level: 3, item_types: ['weapon'] },
        { id: 2, name: 'Guard', min_level: 3, item_types: ['armor', 'shield'] },
        { id: 3, name: 'Fleet', min_level: 5, item_types: ['gear'] },
        { id: 4, name: 'Storm', min_level: 9, item_types: ['weapon'] },
    ],
};

test('rune choices: fits the item, level reached, not on it already; full at the per-item limit', () => {
    assert.deepEqual(runeChoices(info, 'weapon', []).options.map((r) => r.name), ['Keen']);
    assert.deepEqual(runeChoices(info, 'armor', []).options.map((r) => r.name), ['Guard', 'Fleet']);
    assert.deepEqual(runeChoices(info, 'shield', []).options.map((r) => r.name), ['Guard', 'Fleet']);
    const guard: ItemRune = { id: 50, rune_id: 2, name: 'Guard' };
    const onArmor = runeChoices(info, 'armor', [guard]);
    assert.deepEqual(onArmor.options.map((r) => r.name), ['Fleet']);
    assert.equal(onArmor.full, true);
    assert.equal(runeChoices({ ...info, perItem: 2 }, 'armor', [guard]).full, false);
});

test('rune requests', () => {
    assert.deepEqual(checkRuneRequest('inscribe', { kind: 'weapon', item_id: 7, rune_id: 1 }), { request: { op: 'inscribe', kind: 'weapon', itemId: 7, runeId: 1 } });
    assert.deepEqual(checkRuneRequest('inscribe', { kind: 'armor', item_id: 3, rune_id: 9, choice_value: 'fire' }),
        { request: { op: 'inscribe', kind: 'armor', itemId: 3, runeId: 9, choiceValue: 'fire' } });
    assert.ok('error' in checkRuneRequest('inscribe', { kind: 'ring', item_id: 3, rune_id: 9 }));
    assert.ok('error' in checkRuneRequest('inscribe', { kind: 'armor', item_id: 3 }));
    assert.ok('error' in checkRuneRequest('inscribe', { kind: 'armor', item_id: 3, rune_id: 9, choice_value: '' }));
    assert.deepEqual(checkRuneRequest('remove', { item_rune_id: 50 }), { request: { op: 'remove', itemRuneId: 50 } });
    assert.ok('error' in checkRuneRequest('remove', {}));
    assert.deepEqual(checkRuneRequest('runed-weapon', { weapon_id: 7 }), { request: { op: 'runed-weapon', weaponId: 7 } });
    assert.deepEqual(checkRuneRequest('runed-weapon', { weapon_id: null }), { request: { op: 'runed-weapon', weaponId: null } });
    assert.ok('error' in checkRuneRequest('runed-weapon', {}));
});
