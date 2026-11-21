import { test } from 'node:test';
import assert from 'node:assert/strict';
import { learnRefusal, prepareRefusal, checkSpellbookRequest, type SpellCounts } from '../src/spellbook.ts';
import { getSpellCaps } from '../src/spellLimits.ts';

const counts = (c: Partial<SpellCounts> = {}): SpellCounts => ({
    cantrips: 0, spells: 0, prepared_cantrips: 0, prepared_spells: 0, already: false, already_prepared: false, ...c,
});
const mage1 = getSpellCaps('Mage', 1);   // 3 cantrips, prepare 5, know 10
const learn = (o: Partial<Parameters<typeof learnRefusal>[0]>) =>
    learnRefusal({ exists: true, featureOnly: false, baseLevel: 1, highestSlot: 1, level: 1, caps: mage1, counts: counts(), ...o });

test('learning: the same answers the old spell routes gave', () => {
    assert.equal(learn({}), null);
    assert.equal(learn({ exists: false }), 'That spell does not exist');
    assert.match(learn({ featureOnly: true })!, /granted by a class feature/);
    assert.equal(learn({ baseLevel: 2 }), "You can't learn level 2 spells yet. At level 1 you can cast up to level 1.");
    assert.equal(learn({ baseLevel: 0, counts: counts({ cantrips: 3 }) }), 'You already know the most cantrips you can (3) at level 1');
    assert.equal(learn({ counts: counts({ spells: 10 }) }), 'You already know the most spells you can (10) at level 1');
    assert.equal(learn({ counts: counts({ spells: 10, already: true }) }), null);   // re-learning is never blocked
    assert.equal(learn({ caps: null, counts: null }), null);                         // no cap
});

test('learning: shared casters count cantrips and spells together', () => {
    const body5 = getSpellCaps('Warrior', 5);   // Body Magic: 1 known, shared
    assert.equal(learnRefusal({ exists: true, featureOnly: false, baseLevel: 0, highestSlot: 1, level: 5, caps: body5, counts: counts({ spells: 1 }) }),
        'You already know the most spells you can (1) at level 5');
});

test('preparing: learn first, then the prepared and cantrip caps', () => {
    const prep = (baseLevel: number, c: Partial<SpellCounts>) => prepareRefusal({ baseLevel, level: 1, caps: mage1, counts: counts(c) });
    assert.equal(prep(1, {}), 'You have to learn that spell first');
    assert.equal(prep(1, { already: true }), null);
    assert.equal(prep(1, { already: true, prepared_spells: 5 }), 'You can prepare 5 spells at level 1. Unprepare one first.');
    assert.equal(prep(0, { already: true, prepared_cantrips: 3 }), 'You can prepare 3 cantrips at level 1');
    assert.equal(prep(1, { already: true, already_prepared: true, prepared_spells: 5 }), null);   // already prepared: nothing to check
    assert.equal(prepareRefusal({ baseLevel: 1, level: 1, caps: null, counts: null }), null);
});

test('the spell book request names one change and one spell', () => {
    assert.deepEqual(checkSpellbookRequest({ op: 'prepare', spellId: 8 }), { op: 'prepare', spellId: 8 });
    for (const bad of [null, {}, { op: 'burn', spellId: 8 }, { op: 'learn' }, { op: 'learn', spellId: -1 }]) assert.ok('error' in checkSpellbookRequest(bad));
});
