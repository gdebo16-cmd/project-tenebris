import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkMoneyRequest, shortCoinMessage, purseOf, applyMoney, checkMoneyPreset, moneyPresetOf, MONEY_PRESETS, MONEY_PRESET_KEYS, type Purse } from '../src/money.ts';
import { characterToCreature } from '../src/creature.ts';

const purse = (p: Partial<Purse> = {}): Purse => ({ copper: 0, silver: 0, gold: 0, crowns: 0, oracles: 0, ...p });

test('a money request: add or spend, missing coins are 0', () => {
    assert.deepEqual(checkMoneyRequest({ action: 'add', silver: 5 }), { request: { action: 'add', amounts: purse({ silver: 5 }) } });
    assert.deepEqual(checkMoneyRequest({ action: 'spend', copper: 3, oracles: 1 }), { request: { action: 'spend', amounts: purse({ copper: 3, oracles: 1 }) } });
});

test('a money request is refused with a plain message', () => {
    assert.deepEqual(checkMoneyRequest({ silver: 5 }), { error: 'action must be add or spend' });
    assert.deepEqual(checkMoneyRequest({ action: 'steal', silver: 5 }), { error: 'action must be add or spend' });
    assert.deepEqual(checkMoneyRequest({ action: 'add' }), { error: 'Add or spend at least one coin' });
    assert.deepEqual(checkMoneyRequest({ action: 'add', gold: 0 }), { error: 'Add or spend at least one coin' });
    assert.deepEqual(checkMoneyRequest({ action: 'add', gold: -1 }), { error: 'gold must be a whole number, 0 or more' });
    assert.deepEqual(checkMoneyRequest({ action: 'add', gold: 1.5 }), { error: 'gold must be a whole number, 0 or more' });
    assert.deepEqual(checkMoneyRequest({ action: 'add', crowns: 'lots' }), { error: 'crowns must be a whole number, 0 or more' });
    assert.deepEqual(checkMoneyRequest({ action: 'add', copper: true }), { error: 'copper must be a whole number, 0 or more' });
    assert.ok('error' in checkMoneyRequest({ action: 'add', copper: 1_000_001 }));
    assert.ok('error' in checkMoneyRequest(null));
});

test('spending names the first coin that is short', () => {
    const have = purse({ copper: 50, silver: 2, gold: 1 });
    assert.equal(shortCoinMessage(have, purse({ silver: 2, gold: 1 })), null);
    assert.equal(shortCoinMessage(have, purse({ silver: 3 })), 'Not enough silver.');
    assert.equal(shortCoinMessage(have, purse({ silver: 3, crowns: 1 })), 'Not enough silver.');
    assert.equal(shortCoinMessage(have, purse({ oracles: 1 })), 'Not enough oracles.');
    // no change-making: 50 copper doesn't pay 1 silver
    assert.equal(shortCoinMessage(have, purse({ silver: 3, copper: 0 })), 'Not enough silver.');
});

test('add then spend the same coins comes back to the start', () => {
    const start = purse({ gold: 4 });
    const amounts = purse({ copper: 1, gold: 2 });
    const added = applyMoney(start, { action: 'add', amounts });
    assert.deepEqual(added, purse({ copper: 1, gold: 6 }));
    assert.deepEqual(applyMoney(added, { action: 'spend', amounts }), start);
});

test('the Creature carries the purse', () => {
    assert.deepEqual(purseOf({ silver: '3', gold: null }), purse({ silver: 3 }));
    const c = characterToCreature({ character: { id: 1, name: 'Vex', level: 1, max_hp: 10, current_hp: 10, copper: 7, crowns: 2 } });
    assert.deepEqual(c.purse, purse({ copper: 7, crowns: 2 }));
});

test('default money: three presets, defined once', () => {
    assert.deepEqual(MONEY_PRESET_KEYS, ['impoverished', 'average', 'wealthy']);
    assert.deepEqual(MONEY_PRESETS.impoverished.purse, purse({ copper: 10 }));
    assert.deepEqual(MONEY_PRESETS.average.purse, purse({ copper: 10, silver: 10 }));
    assert.deepEqual(MONEY_PRESETS.wealthy.purse, purse({ copper: 10, silver: 10, gold: 10 }));
});

test('default money: only the three keys are accepted, and a purse names its preset', () => {
    assert.deepEqual(checkMoneyPreset('wealthy'), { key: 'wealthy' });
    for (const bad of ['Wealthy', 'rich', '', null, 10, { key: 'average' }]) assert.ok('error' in checkMoneyPreset(bad), JSON.stringify(bad));
    assert.equal(moneyPresetOf(purse()), null);
    assert.equal(moneyPresetOf(purse({ copper: 10, silver: 10 })), 'average');
    assert.equal(moneyPresetOf(purse({ copper: 10, silver: 10, gold: 10, crowns: 1 })), null);
});
