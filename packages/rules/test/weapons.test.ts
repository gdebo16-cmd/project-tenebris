import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterSortWeapons, EMPTY_WEAPON_FILTER } from '../src/weapons.ts';

const list = [
    { id: 1, name: 'Longsword', weapon_category: 'Versatile', rarity: 'Common' },
    { id: 2, name: 'Dagger', weapon_category: 'Minor', rarity: 'Magical' },
    { id: 3, name: 'Greataxe', weapon_category: 'Great', rarity: 'Common' },
    { id: 4, name: 'Axe of Ages', weapon_category: 'Great', rarity: 'Calamity' },
    { id: 5, name: 'Odd Stick', weapon_category: null, rarity: null },
];
const names = (ws: { name: string }[]) => ws.map((w) => w.name);

test('weapon filter: no filter sorts by name and keeps everything', () => {
    assert.deepEqual(names(filterSortWeapons(list, EMPTY_WEAPON_FILTER)), ['Axe of Ages', 'Dagger', 'Greataxe', 'Longsword', 'Odd Stick']);
    assert.deepEqual(names(filterSortWeapons(list)), names(filterSortWeapons(list, EMPTY_WEAPON_FILTER)));
});

test('weapon filter: category and rarity narrow the list', () => {
    assert.deepEqual(names(filterSortWeapons(list, { category: 'Great' })), ['Axe of Ages', 'Greataxe']);
    assert.deepEqual(names(filterSortWeapons(list, { rarity: 'Common' })), ['Greataxe', 'Longsword']);
    assert.deepEqual(names(filterSortWeapons(list, { category: 'Great', rarity: 'Common' })), ['Greataxe']);
    assert.deepEqual(filterSortWeapons(list, { category: 'Reach' }), []);
});

test('weapon filter: sort by category or rarity in display order, unknown last, then by name', () => {
    assert.deepEqual(names(filterSortWeapons(list, { sort: 'category' })), ['Dagger', 'Longsword', 'Axe of Ages', 'Greataxe', 'Odd Stick']);
    assert.deepEqual(names(filterSortWeapons(list, { sort: 'rarity' })), ['Greataxe', 'Longsword', 'Dagger', 'Axe of Ages', 'Odd Stick']);
    assert.equal(list[0].name, 'Longsword');   // the input list is not changed
});
