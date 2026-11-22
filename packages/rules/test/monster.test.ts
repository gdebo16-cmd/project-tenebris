import { test } from 'node:test';
import assert from 'node:assert/strict';
import { monsterToCreature, healthWord, monsterGlimpse, applyMonsterHp, applyMonsterTempHp, checkAddMonster, checkNotes, type PackMonster, type CampaignMonsterRow } from '../src/monster.ts';
import { resolveAct } from '../src/actions.ts';
import { fixedDice } from './helpers.ts';

// The real Ash Hound from the content pack
const hound: PackMonster = {
    id: 2, name: 'Ash Hound', description: 'A lean beast with smoldering fur.', art_url: '/images/monsters/ash_hound.png',
    type: 'beast', threat_level: 2, xp: 450, str: 14, dex: 15, con: 13, int: 3, wis: 12, cha: 6, spd: 12, luc: 10,
    save_proficiencies: ['dex'], skill_bonuses: { awareness: 3 }, max_hp: 22, hit_dice: '4d8+4', armor: 13,
    speed: { walk: 40, climb: 0, fly: 0, swim: 0 }, senses: { darkvision: 60 }, languages: [],
    resistances: ['fire', 'fire'], immunities: [], weaknesses: ['frost'], condition_immunities: [],
    attacks: [{ name: 'Bite', stat: 'str', to_hit_bonus: 0, damage_dice: '1d8', damage_type: 'piercing', extra_dice: '1d4', extra_type: 'fire', reach: 5, action_type: 'action' }],
    features: [{ name: 'Ember Trail', action_type: 'passive', description: 'Leaves burning ground where it moves.' }],
};
const row = (over: Partial<CampaignMonsterRow> = {}): CampaignMonsterRow =>
    ({ id: 7, campaign_id: 3, monster_id: 2, nickname: null, current_hp: 22, temp_hp: 0, conditions: {}, exhaustion: 0, notes: '', ...over });

test('monsterToCreature: the Ash Hound at full health', () => {
    const c = monsterToCreature(hound, row());
    assert.equal(c.kind, 'monster');
    assert.equal(c.id, 7);
    assert.equal(c.name, 'Ash Hound');
    assert.deepEqual(c.hp, { current: 22, max: 22, temp: 0, band: 4 });
    assert.equal(c.armorClass.value, 13);
    assert.deepEqual(c.armorClass.resist, ['fire']);           // duplicates dropped
    assert.equal(c.initiative, 2 + 4);                         // Precision 15 -> +2, plus the full-health band
    assert.equal(c.proficiency, 2);                            // threat 2
    assert.equal(c.speedFt, 40);
    assert.equal(c.actions.length, 1);
    const bite = c.actions[0];
    assert.equal(bite.key, 'a0');
    assert.equal(bite.hit, 6 + 2);                             // initiative + Might mod
    assert.equal(bite.dice, '1d8');
    assert.equal(bite.dmgMod, 2);
    assert.deepEqual(bite.riders, [{ name: 'Bite', dice: '1d4', type: 'fire' }]);
    assert.equal(c.features[0].name, 'Ember Trail');
    assert.equal(c.features[0].perRest, null);
    assert.equal(c.skills.find((s) => s.id === 'awareness')?.proficient, true);
    assert.equal(c.monster?.threat, 2);
    assert.equal(c.monster?.xp, 450);
    assert.deepEqual(c.monster?.saves, ['Precision']);
    assert.deepEqual(c.monster?.movement, { walk: 40 });       // zero climb/fly/swim left out
});

test('monsterToCreature: a nickname, and hurt (speed and initiative drop with health)', () => {
    const c = monsterToCreature(hound, row({ nickname: 'Smoky', current_hp: 11 }));
    assert.equal(c.name, 'Smoky');
    assert.equal(c.monster?.packName, 'Ash Hound');
    assert.equal(c.hp.band, 2);
    assert.equal(c.initiative, 4);
    assert.equal(c.speedFt, 20);
});

test('resolveAct rolls a monster attack with the same rules as a character', () => {
    const c = monsterToCreature(hound, row());
    const hit = resolveAct(c, { actionKey: 'a0', kind: 'hit' }, null, fixedDice(10));
    assert.deepEqual(hit, { text: 'Chance to hit: 18', critKey: null });
    const dmg = resolveAct(c, { actionKey: 'a0', kind: 'damage' }, null, fixedDice(5, 3));
    assert.deepEqual(dmg, { text: 'Damage dealt: 7 + 3 fire = 10', critKey: null });
    const check = resolveAct(c, { actionKey: 'skill:awareness', kind: 'check' }, null, fixedDice(10));
    assert.ok('text' in check && check.text === 'Awareness check: 15');   // Judgment +1, Speed +1, bonus +3, d20 10
});

test('healthWord', () => {
    assert.equal(healthWord(22, 22), 'Unhurt');
    assert.equal(healthWord(21, 22), 'Wounded');
    assert.equal(healthWord(11, 22), 'Wounded');
    assert.equal(healthWord(10, 22), 'Bloodied');
    assert.equal(healthWord(5, 22), 'Near death');
    assert.equal(healthWord(0, 22), 'Down');
});

test('monsterGlimpse shows only name, type, a health word and the conditions it has', () => {
    const g = monsterGlimpse(monsterToCreature(hound, row({ current_hp: 4, conditions: { ground: true, blind: false } })));
    assert.deepEqual(g, { id: 7, name: 'Ash Hound', type: 'beast', portrait: '/images/monsters/ash_hound.png', health: 'Near death', conditions: ['ground'] });
});

test('applyMonsterHp: damage eats temp HP first and stops at 0; healing stops at max', () => {
    assert.deepEqual(applyMonsterHp({ current_hp: 20, temp_hp: 5 }, 22, { action: 'damage', amount: 8 }), { current_hp: 17, temp_hp: 0 });
    assert.deepEqual(applyMonsterHp({ current_hp: 20, temp_hp: 5 }, 22, { action: 'damage', amount: 3 }), { current_hp: 20, temp_hp: 2 });
    assert.deepEqual(applyMonsterHp({ current_hp: 3, temp_hp: 0 }, 22, { action: 'damage', amount: 50 }), { current_hp: 0, temp_hp: 0 });
    assert.deepEqual(applyMonsterHp({ current_hp: 20, temp_hp: 0 }, 22, { action: 'heal', amount: 9 }), { current_hp: 22, temp_hp: 0 });
});

test('applyMonsterTempHp keeps the higher, or clears', () => {
    assert.deepEqual(applyMonsterTempHp({ current_hp: 9, temp_hp: 5 }, { amount: 3, clear: false }), { current_hp: 9, temp_hp: 5 });
    assert.deepEqual(applyMonsterTempHp({ current_hp: 9, temp_hp: 5 }, { amount: 8, clear: false }), { current_hp: 9, temp_hp: 8 });
    assert.deepEqual(applyMonsterTempHp({ current_hp: 9, temp_hp: 5 }, { amount: 0, clear: true }), { current_hp: 9, temp_hp: 0 });
});

test('checkAddMonster and checkNotes', () => {
    assert.deepEqual(checkAddMonster({ monster_id: 2 }), { monsterId: 2, nickname: null });
    assert.deepEqual(checkAddMonster({ monster_id: '2', nickname: '  Smoky ' }), { monsterId: 2, nickname: 'Smoky' });
    assert.ok('error' in checkAddMonster({}));
    assert.ok('error' in checkAddMonster({ monster_id: 2, nickname: 5 }));
    assert.ok('error' in checkAddMonster({ monster_id: 2, nickname: 'x'.repeat(61) }));
    assert.deepEqual(checkNotes({ notes: 'ambush at the bridge' }), { notes: 'ambush at the bridge' });
    assert.ok('error' in checkNotes({ notes: 3 }));
});
