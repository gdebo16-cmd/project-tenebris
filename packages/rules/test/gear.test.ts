import { test } from 'node:test';
import assert from 'node:assert/strict';
import { armorTypesFromProf, checkGearTab, defaultGear, gearChoices, STARTING_MONEY, weaponCategoryNamesFromProf } from '../src/gear.ts';

const pack = {
    weapon_category: [{ id: 1, name: 'Minor' }, { id: 2, name: 'Great' }],
    armor: [
        { id: 1, name: 'Leather', armor_type: 'light', rarity: 'common' },
        { id: 2, name: 'Plate', armor_type: 'heavy', rarity: 'common' },
        { id: 3, name: 'Gold Plate', armor_type: 'heavy', rarity: 'rare' },
    ],
    weapons: [
        { id: 10, name: 'Dagger', category_id: 1, rarity: 'common' },
        { id: 11, name: 'Greatsword', category_id: 2, rarity: 'common' },
        { id: 12, name: 'Named Blade', category_id: 1, rarity: 'common', is_unique: true },
    ],
    items: [{ id: 20, name: 'Rope', rarity: 'common' }, { id: 21, name: 'Potion', rarity: 'magical' }],
};

test('armor and weapon proficiencies read the role text', () => {
    assert.deepEqual(armorTypesFromProf('Light Armor, Shields, none'), ['light', 'shield']);
    assert.deepEqual(armorTypesFromProf('-'), []);
    assert.deepEqual(weaponCategoryNamesFromProf('Minor, Great'), ['Minor', 'Great']);
    assert.deepEqual(weaponCategoryNamesFromProf('none'), []);
});

test('gear choices mark proficient and not, and skip rare or unique rows', () => {
    const choices = gearChoices(pack, { armor_prof: 'Light Armor', weapon_prof: 'Minor', tool_prof: 'Herbalism Kit' });
    assert.deepEqual(choices.proficiencies, { armor: ['light'], weapons: ['Minor'], tools: ['Herbalism Kit'] });
    assert.deepEqual(choices.armor.map((armor) => [armor.name, armor.proficient]), [['Leather', true], ['Plate', false]]);
    assert.deepEqual(choices.weapons.map((weapon) => weapon.name), ['Dagger', 'Greatsword']);
    assert.equal(choices.weapons[0].proficient, true);
    assert.equal(choices.weapons[1].proficient, false);
    assert.deepEqual(choices.items.map((item) => item.name), ['Rope']);
});

test('a gear save uses the placeholder money and refuses an unknown weapon', () => {
    const choices = gearChoices(pack, { armor_prof: 'Light Armor', weapon_prof: 'Minor' });
    const saved = checkGearTab(choices, { weapon_id: 11, armor_id: '', item_ids: [20], money: 999 });
    assert.ok(!('error' in saved));
    if ('error' in saved) return;
    assert.equal(saved.weapon_id, 11);
    assert.equal(saved.armor_id, null);
    assert.deepEqual(saved.item_ids, [20]);
    assert.equal(saved.money, STARTING_MONEY);
    assert.ok('error' in checkGearTab(choices, { weapon_id: 99 }));
    assert.ok('error' in checkGearTab(choices, { weapon_id: 10, item_ids: [20, 20] }));
});

test('auto default picks the first proficient weapon and armor', () => {
    const choices = gearChoices(pack, { armor_prof: 'Light Armor', weapon_prof: 'Minor' });
    assert.deepEqual(defaultGear(choices), { weapon_id: 10, armor_id: 1 });
    assert.ok('error' in defaultGear(gearChoices(pack, { weapon_prof: 'Nope' })));
});
