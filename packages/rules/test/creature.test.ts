import { test } from 'node:test';
import assert from 'node:assert/strict';
import { characterToCreature, spellDiceAt, spellHealAt, FIST_DICE, type SheetData } from '../src/creature.ts';

// Three characters shaped like GET /api/characters/:id. Every expected number is worked out by hand
// from the old sheet's math (Actions.jsx, ArmorClass.jsx, Skills.jsx, CharacterSheet.jsx).

// A level 5 Warrior at full HP: Might primary, a versatile longsword held in two hands, a dual-wielded dagger.
const warrior: SheetData = {
    character: {
        id: 1, name: 'Brann', level: 5, max_hp: 40, current_hp: 40, temp_hp: 3,
        str: 16, dex: 14, con: 15, int: 8, wis: 10, cha: 12, spd: 12, luc: 9,
        spell_stat: 'str', casting_stat: 'str', class_name: 'Warrior', race_base_speed: 30,
        skill_proficiencies: ['Balance'], class_saving_throws: ['STR', 'CON'],
    },
    ownedArmor: [
        { id: 1, name: 'Chain Shirt', is_equipped: true, armor_type: 'medium', ac_bonus: 3, con_cap: 2 },
        { id: 2, name: 'Shield', is_equipped: true, armor_type: 'shield', ac_bonus: 2 },
    ],
    ownedWeapons: [
        { id: 10, name: 'Longsword', is_equipped: true, category: 'melee', damage_dice: '1d8', versatile_dice: '1d10', properties: ['versatile'], two_handed: true },
        { id: 11, name: 'Dagger', is_equipped: true, category: 'melee', damage_dice: '1d4', properties: ['light'], dual_wield: true },
        { id: 12, name: 'Bow', is_equipped: false, category: 'ranged', damage_dice: '1d8' },
    ],
};

test('warrior: core numbers', () => {
    const c = characterToCreature(warrior);
    assert.equal(c.hp.band, 4);                 // full health
    assert.equal(c.initiative, 2 + 4);          // DEX mod 2 + band 4
    assert.equal(c.proficiency, 3);
    assert.equal(c.armorClass.value, 10 + 2 + 3 + 2);   // CON mod 2 (cap 2) + armor 3 + shield 2
    assert.equal(c.speedFt, 30 + 12);           // full HP, no Fleet Rune
    assert.deepEqual(c.hp, { current: 40, max: 40, temp: 3, band: 4 });
    assert.equal(c.cracks.conSave, 2 + 3);      // CON mod + proficiency (CON save)
});

test('warrior: weapons', () => {
    const c = characterToCreature(warrior);
    const longsword = c.actions.find((a) => a.name === 'Longsword')!;
    assert.equal(longsword.hit, 6 + 3);         // init 6 + Might mod 3
    assert.equal(longsword.dice, '1d10');       // versatile die in two hands
    assert.equal(longsword.dmgMod, 3);
    assert.equal(longsword.hands, 'Two hands');
    // The dagger is dual wielded: a bonus action, with no ability mod on damage
    assert.deepEqual(c.bonusActions.map((a) => a.name), ['Dagger']);
    assert.equal(c.bonusActions[0].dmgMod, 0);
    assert.equal(c.bonusActions[0].hit, 9);
    // The bow isn't equipped, Fists are always last
    assert.deepEqual(c.actions.map((a) => a.name), ['Longsword', 'Fists']);
});

test('fists shrink as HP drops', () => {
    assert.deepEqual(FIST_DICE, ['1', '1', '1d4', '1d6', '1d8']);
    const hurt = characterToCreature({ ...warrior, character: { ...warrior.character, current_hp: 15 } });   // 37.5% -> band 1
    const fists = hurt.actions.find((a) => a.key === 'fists')!;
    assert.equal(fists.dice, '1');
    assert.equal(fists.hit, 2 + 1 + 3);   // DEX mod + band 1 + STR mod
    assert.equal(hurt.speedFt, Math.round(42 * 15 / 40));
});

test('skills add two stat mods, plus proficiency when trained', () => {
    const c = characterToCreature(warrior);
    const balance = c.skills.find((s) => s.name === 'Balance')!;
    assert.equal(balance.proficient, true);
    assert.equal(balance.value, 3 + 2 + 3);   // STR + DEX + proficiency
    const memory = c.skills.find((s) => s.name === 'Memory')!;
    assert.equal(memory.value, -1 + 2);       // INT + CON
});

// A level 11 Mage: Intellect caster with a two-beam spell, a save spell and a heal.
const mage: SheetData = {
    character: {
        id: 2, name: 'Ilse', level: 11, max_hp: 50, current_hp: 30,
        str: 8, dex: 14, con: 12, int: 18, wis: 12, cha: 10, spd: 10, luc: 10,
        spell_stat: 'int', casting_stat: 'int', class_name: 'Mage', race_base_speed: 30, has_embers: true, embers_spent: 2,
    },
    learnedSpells: [
        { id: 1, name: 'Arc Bolts', base_level: 0, is_action: true, is_prepared: true, attack_type: 'ranged', base_damage_dice: '1d10', beam_scaling: [{ level: 5, beams: 2 }, { level: 11, beams: 3 }] },
        { id: 2, name: 'Frost Wave', base_level: 2, is_action: true, is_prepared: true, opponent_save_roll: 'CON', base_damage_dice: '3d6', upcasts: [{ cast_level: 3, damage_dice: '4d6' }] },
        { id: 3, name: 'Mend', base_level: 1, is_action: true, is_prepared: true, action_type: 'bonus', heal_dice: '1d8', heal_add_mod: true },
        { id: 4, name: 'Not ready', base_level: 1, is_action: true, is_prepared: false },
    ],
};

test('mage: spell numbers', () => {
    const c = characterToCreature(mage);
    assert.equal(c.spellcasting.toHit, 4 + 4);     // INT mod 4 + proficiency 4
    assert.equal(c.spellcasting.saveDc, 16);
    assert.deepEqual(c.spells.map((s) => s.name), ['Arc Bolts', 'Frost Wave', 'Mend']);   // unprepared left out
    const bolts = c.spells[0];
    assert.equal(bolts.beams, 3);
    assert.equal(bolts.toHit, 8);
    assert.equal(c.spells[2].tile, 'bonus');
    assert.equal(c.spells[2].healMod, 4);
    assert.equal(spellDiceAt(c.spells[1], 3), '4d6');
    assert.equal(spellDiceAt(c.spells[1], 2), '3d6');
    assert.equal(spellHealAt(c.spells[2], 2), '1d8');
});

test('mage: embers', () => {
    const c = characterToCreature(mage);
    assert.equal(c.embers.max, 6 + 4);        // ceil(11 / 2) + INT mod
    assert.equal(c.embers.current, 8);
});

// A level 10 Tome of Inscription Mage with a runed, Keen-runed spear and Guard + Warding runes on armor.
const runeWeaver: SheetData = {
    character: {
        id: 3, name: 'Tamsin', level: 10, max_hp: 60, current_hp: 60,
        str: 10, dex: 12, con: 14, int: 16, wis: 10, cha: 10, spd: 10, luc: 10,
        spell_stat: 'int', casting_stat: 'int', class_name: 'Mage', subclass_name: 'Tome of Inscription', race_base_speed: 25,
    },
    ownedArmor: [
        { id: 5, name: 'Leather', is_equipped: true, armor_type: 'light', ac_bonus: 1, runes: [{ id: 1, name: 'Guard Rune' }, { id: 2, name: 'Warding Rune', choice_value: 'fire' }, { id: 3, name: 'Fleet Rune' }] },
    ],
    ownedWeapons: [
        { id: 20, name: 'Spear', is_equipped: true, category: 'melee', damage_dice: '1d6', is_runed: true,
          runes: [{ id: 4, name: 'Keen Rune' }, { id: 5, name: 'Ember Rune', dice: '1d4', is_damage_rider: true }] },
    ],
};

test('rune weaver: runed weapon, Guard, Warding, Fleet', () => {
    const c = characterToCreature(runeWeaver);
    const spear = c.actions.find((a) => a.name === 'Spear')!;
    assert.equal(spear.stat, 'INT');
    assert.equal(spear.hit, (1 + 4) + 3 + 1);    // init (DEX 1 + band 4) + INT 3 + Keen 1
    assert.equal(spear.dmgMod, 3);
    assert.deepEqual(spear.riders, [{ name: 'Ember Rune', dice: '1d4', type: 'fire' }]);
    assert.equal(c.armorClass.value, 10 + 2 + 1 + 1);   // CON 2 + leather 1 + Guard 1
    assert.deepEqual(c.armorClass.resist, ['fire']);
    assert.equal(c.speedFt, 25 + 10 + 5);              // Fleet Rune
    assert.equal(c.strikes.runicStrikeDice, '2d6');
});

test('reaver: soul-branded weapon uses Confidence', () => {
    const reaver: SheetData = {
        character: { ...warrior.character, id: 4, class_name: 'Reaver', cha: 18, level: 11 },
        ownedWeapons: [{ id: 30, name: 'Glaive', is_equipped: true, category: 'melee', damage_dice: '1d10', properties: ['two-handed'], soul_branded: true }],
    };
    const c = characterToCreature(reaver);
    const glaive = c.actions.find((a) => a.name === 'Glaive')!;
    assert.equal(glaive.stat, 'CHA');
    assert.equal(glaive.hit, 6 + 4);   // init 6 + CHA 4
    assert.equal(c.strikes.soulStrikeDice, '2d8');
    assert.equal(c.classDc, 8 + 4 + 4);
});
