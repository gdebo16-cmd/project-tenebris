import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkHpRequest, checkTempHpRequest, hpChange, MAX_HP_CHANGE } from '../src/health.ts';

test('hp: heal or damage, a whole amount from 1', () => {
    assert.deepEqual(checkHpRequest({ action: 'damage', amount: 4 }), { request: { action: 'damage', amount: 4 } });
    assert.deepEqual(checkHpRequest({ action: 'heal', amount: 1 }), { request: { action: 'heal', amount: 1 } });
    assert.deepEqual(checkHpRequest({ action: 'poke', amount: 4 }), { error: 'action must be heal or damage' });
    assert.ok('error' in checkHpRequest({ amount: 4 }));
    for (const bad of [0, -3, 2.5, '4', null, undefined, MAX_HP_CHANGE + 1]) assert.ok('error' in checkHpRequest({ action: 'heal', amount: bad }), String(bad));
    assert.equal(hpChange({ action: 'damage', amount: 4 }), -4);
    assert.equal(hpChange({ action: 'heal', amount: 4 }), 4);
});

test('temp hp: an amount from 1, or clear', () => {
    assert.deepEqual(checkTempHpRequest({ amount: 5 }), { request: { amount: 5, clear: false } });
    assert.deepEqual(checkTempHpRequest({ clear: true }), { request: { amount: 0, clear: true } });
    assert.deepEqual(checkTempHpRequest({ clear: false, amount: 2 }), { request: { amount: 2, clear: false } });
    assert.ok('error' in checkTempHpRequest({ clear: 'yes' }));
    for (const bad of [0, -1, 1.5, '5', undefined]) assert.ok('error' in checkTempHpRequest({ amount: bad }), String(bad));
});
