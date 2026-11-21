import { test, expect } from '@playwright/test';
import { login } from './helpers.js';

// The block sheet (R5) is the sheet at /characters/:id: it loads from /api/sheets, and a to-hit roll comes back from the server.
test('new sheet: loads and rolls through the server', async ({ page }) => {
  await login(page);
  // Any finished character of the test account will do
  const home = await (await page.request.get('/api/home')).json();
  test.skip(!home.characters?.length, 'The test account has no finished character');
  const id = home.characters[0].id;

  await page.goto(`/characters/${id}`);
  await expect(page.getByRole('heading', { name: home.characters[0].name })).toBeVisible();

  // Fists are on every character: roll to hit and expect the server's answer in the roll feed
  await page.getByRole('button', { name: 'Fists to hit' }).click();
  await expect(page.getByRole('region', { name: 'Rolls' })).toContainText('Fists: Chance to hit');

  // A stat check, also rolled by the server
  await page.getByRole('button', { name: 'Roll Might' }).click();
  await expect(page.getByRole('region', { name: 'Rolls' })).toContainText('Might roll');
});

// Rests, feature uses, casting and the spell book are server actions on the new sheet (R5).
// Only a long rest writes (it fully restores the test character); the other checks are refusals that change nothing.
test('new sheet: rest, features, casting and the spell book go through the server', async ({ page }) => {
  await login(page);
  const home = await (await page.request.get('/api/home')).json();
  test.skip(!home.characters?.length, 'The test account has no finished character');
  const id = home.characters[0].id;
  const base = `/api/sheets/character/${id}`;

  // Refused requests answer 400 and spend nothing
  expect((await page.request.post(`${base}/rest`, { data: { type: 'nap' } })).status()).toBe(400);
  expect((await page.request.post(`${base}/feature`, { data: { featureKey: 'class-999999' } })).status()).toBe(400);
  expect((await page.request.post(`${base}/cast`, { data: { actionKey: 'not-a-spell' } })).status()).toBe(400);
  expect((await page.request.post(`${base}/spellbook`, { data: { op: 'burn', spellId: 1 } })).status()).toBe(400);

  // A spell that isn't learned can't be unprepared
  const notLearned = { op: 'unprepare', spellId: 999999 };
  const refused = await page.request.post(`${base}/spellbook`, { data: notLearned });
  expect(refused.status()).toBe(400);
  expect((await refused.json()).error).toBe('You have to learn that spell first');
  // The old sheet's spell routes are gone
  expect((await page.request.post(`/api/characters/${id}/spells/unprepare`, { data: { spell_id: 999999 } })).status()).toBe(404);
  expect((await page.request.get(`/api/characters/${id}/spellbook`)).status()).toBe(404);

  // The spell book loads for the owner
  const book = await page.request.get(`${base}/spellbook`);
  expect(book.status()).toBe(200);
  expect(Array.isArray((await book.json()).learnedSpells)).toBe(true);

  // A long rest from the sheet: the server's answer lands in the roll feed
  await page.goto(`/characters/${id}`);
  await page.getByRole('button', { name: 'Rest', exact: true }).click();
  await page.getByRole('button', { name: 'Long Rest' }).click();
  await expect(page.getByRole('region', { name: 'Rolls' })).toContainText('Long Rest: fully restored!');

  // The Features and Spells tabs render
  await page.getByRole('button', { name: 'Features' }).click();
  await expect(page.getByRole('region', { name: 'Features' })).toBeVisible();
  await page.getByRole('button', { name: 'Spells' }).click();
  await expect(page.getByRole('region', { name: 'Spell book' })).toBeVisible();
});

// The purse on the Gear tab: add coins, spend them back (net zero), and an overspend shows the server's message.
test('new sheet: purse adds and spends coins through the server', async ({ page }) => {
  await login(page);
  const home = await (await page.request.get('/api/home')).json();
  test.skip(!home.characters?.length, 'The test account has no finished character');
  const id = home.characters[0].id;
  const start = (await (await page.request.get(`/api/sheets/character/${id}`)).json()).creature.purse;

  await page.goto(`/characters/${id}`);
  await page.getByRole('button', { name: 'Gear', exact: true }).click();
  const purse = page.getByRole('region', { name: 'Purse' });
  await expect(purse.getByLabel(`${start.copper} Copper`, { exact: true })).toBeVisible();

  // Nothing typed: Add and Spend stay disabled
  await purse.getByRole('button', { name: /^Coins/ }).click();
  await expect(purse.getByRole('button', { name: 'Add' })).toBeDisabled();

  // Add 3 copper and 2 silver: the totals update and the panel closes
  await purse.getByLabel('Copper amount').fill('3');
  await purse.getByLabel('Silver amount').fill('2');
  await purse.getByRole('button', { name: 'Add' }).click();
  await expect(purse.getByLabel(`${start.copper + 3} Copper`, { exact: true })).toBeVisible();
  await expect(purse.getByLabel(`${start.silver + 2} Silver`, { exact: true })).toBeVisible();
  await expect(purse.getByRole('button', { name: 'Add' })).toBeHidden();

  // Spend the same coins back
  await purse.getByRole('button', { name: /^Coins/ }).click();
  await purse.getByLabel('Copper amount').fill('3');
  await purse.getByLabel('Silver amount').fill('2');
  await purse.getByRole('button', { name: 'Spend' }).click();
  await expect(purse.getByLabel(`${start.copper} Copper`, { exact: true })).toBeVisible();
  await expect(purse.getByRole('button', { name: 'Spend' })).toBeHidden();

  // Overspend: the panel stays open with the server's message, and nothing changes
  await purse.getByRole('button', { name: /^Coins/ }).click();
  await purse.getByLabel('Oracles amount').fill(String(start.oracles + 1));
  await purse.getByRole('button', { name: 'Spend' }).click();
  await expect(purse.getByRole('alert')).toHaveText('Not enough oracles.');
  await expect(purse.getByRole('button', { name: 'Spend' })).toBeVisible();

  const end = (await (await page.request.get(`/api/sheets/character/${id}`)).json()).creature.purse;
  expect(end).toEqual(start);
});
// Conditions and exhaustion change through the sheet's own route (owner or DM). Each change is undone (net zero).
test('new sheet: conditions and exhaustion change through the server', async ({ page }) => {
  await login(page);
  const home = await (await page.request.get('/api/home')).json();
  test.skip(!home.characters?.length, 'The test account has no finished character');
  const id = home.characters[0].id;
  const base = `/api/sheets/character/${id}`;
  const read = async () => {
    const { creature } = await (await page.request.get(base)).json();
    return { conditions: creature.conditions, exhaustion: creature.exhaustion };
  };
  const start = await read();

  // Refusals answer 400 and change nothing
  expect((await page.request.post(`${base}/conditions`, { data: { conditions: { flying: true } } })).status()).toBe(400);
  expect((await page.request.post(`${base}/conditions`, { data: { exhaustion: 11 } })).status()).toBe(400);
  expect((await page.request.post(`${base}/conditions`, { data: {} })).status()).toBe(400);
  // The old owner-only state route is gone
  expect((await page.request.patch(`/api/characters/${id}/state`, { data: { exhaustion: 1 } })).status()).toBe(404);

  await page.goto(`/characters/${id}`);
  const block = page.getByRole('region', { name: 'Conditions' });
  const bleed = block.getByRole('button', { name: 'Bleed' });
  const wasBleeding = !!start.conditions.bleed;
  await bleed.click();
  await expect(bleed).toHaveAttribute('aria-pressed', String(!wasBleeding));
  await bleed.click();
  await expect(bleed).toHaveAttribute('aria-pressed', String(wasBleeding));

  const up = start.exhaustion < 10;
  await block.getByRole('button', { name: up ? 'More exhaustion' : 'Less exhaustion' }).click();
  await expect(block).toContainText(`Exhaustion ${start.exhaustion + (up ? 1 : -1)}`);
  await block.getByRole('button', { name: up ? 'Less exhaustion' : 'More exhaustion' }).click();
  await expect(block).toContainText(`Exhaustion ${start.exhaustion}`);

  const end = await read();
  expect(end.exhaustion).toBe(start.exhaustion);
  expect(!!end.conditions.bleed).toBe(wasBleeding);
});

// The Gear tab: equip and unequip a weapon and switch a weapon option, all through the server (owner or DM).
// The Actions tab follows each change. Everything is put back (net zero).
test('new sheet: gear tab equips, unequips and sets weapon options through the server', async ({ page }) => {
  await login(page);
  const home = await (await page.request.get('/api/home')).json();
  test.skip(!home.characters?.length, 'The test account has no finished character');
  const id = home.characters[0].id;
  const base = `/api/sheets/character/${id}`;
  const weaponsNow = async () => (await (await page.request.get(base)).json()).creature.gear.weapons
    .map((w) => ({ id: w.id, name: w.name, is_equipped: !!w.is_equipped, dual_wield: !!w.dual_wield, two_handed: !!w.two_handed }))
    .sort((a, b) => a.id - b.id);
  const start = await weaponsNow();
  test.skip(!start.length, 'The test character has no weapon');
  const weapon = start.find((w) => w.is_equipped) ?? start[0];

  // Refusals: a bad id or a missing flag is 400, a weapon the character doesn't own is 404
  const inv = `/api/characters/${id}/inventory/weapon`;
  expect((await page.request.post(`${inv}/equip`, { data: { weapon_id: 'x' } })).status()).toBe(400);
  expect((await page.request.post(`${inv}/dual-wield`, { data: { weapon_id: weapon.id } })).status()).toBe(400);
  expect((await page.request.post(`${inv}/equip`, { data: { weapon_id: 999999 } })).status()).toBe(404);

  await page.goto(`/characters/${id}`);
  const actionsTab = page.getByRole('button', { name: 'Actions', exact: true });
  const gearTab = page.getByRole('button', { name: 'Gear', exact: true });
  const toHit = page.getByRole('button', { name: `${weapon.name} to hit` });
  const gear = page.getByRole('region', { name: 'Gear', exact: true });
  const flip = async (equipped) => {
    await gearTab.click();
    await gear.getByRole('button', { name: `${equipped ? 'Unequip' : 'Equip'} ${weapon.name}` }).click();
    await expect(gear.getByRole('button', { name: `${equipped ? 'Equip' : 'Unequip'} ${weapon.name}` })).toBeVisible();
    await actionsTab.click();
    await expect(toHit).toHaveCount(equipped ? 0 : 1);
  };

  // Unequip then equip again (or the other way round if it starts unequipped)
  await flip(weapon.is_equipped);
  await flip(!weapon.is_equipped);

  // An equipped one-handed weapon offers Dual wield: on (it moves to bonus actions), then off
  await gearTab.click();
  const equippedNow = (await weaponsNow()).find((w) => w.id === weapon.id).is_equipped;
  const dual = gear.getByLabel(`${weapon.name} options`).getByRole('checkbox', { name: 'Dual wield' });
  if (equippedNow && await dual.count()) {
    const wasDual = weapon.dual_wield;
    await dual.click();
    await expect(dual).toBeChecked({ checked: !wasDual });
    if (!wasDual) await expect(gear.getByText('Bonus action; no ability modifier on damage.')).toBeVisible();
    await dual.click();
    await expect(dual).toBeChecked({ checked: wasDual });
  }

  expect(await weaponsNow()).toEqual(start);
});

// The Gear tab's weapon filter (category, rarity, sort), as on the old sheet. Nothing is saved.
test('new sheet: gear tab filters the weapon list', async ({ page }) => {
  await login(page);
  const home = await (await page.request.get('/api/home')).json();
  test.skip(!home.characters?.length, 'The test account has no finished character');
  const id = home.characters[0].id;
  const { creature } = await (await page.request.get(`/api/sheets/character/${id}`)).json();
  const weapon = creature.gear.weapons.find((w) => w.weapon_category);
  test.skip(!weapon, 'The test character has no weapon with a category');

  await page.goto(`/characters/${id}`);
  await page.getByRole('button', { name: 'Gear', exact: true }).click();
  const gear = page.getByRole('region', { name: 'Gear', exact: true });
  const row = gear.getByText(weapon.name, { exact: true });
  await expect(row).toBeVisible();

  // Its own category keeps it; another category hides it and says so
  await gear.getByLabel('Weapon category').selectOption(weapon.weapon_category);
  await expect(row).toBeVisible();
  const other = weapon.weapon_category === 'Minor' ? 'Reach' : 'Minor';
  const othersOwned = creature.gear.weapons.some((w) => w.weapon_category === other);
  await gear.getByLabel('Weapon category').selectOption(other);
  await expect(row).toBeHidden();
  if (!othersOwned) await expect(gear.getByText('No weapons match.')).toBeVisible();

  // Back to all; the sort picker offers name, category and rarity
  await gear.getByLabel('Weapon category').selectOption('');
  await expect(row).toBeVisible();
  await gear.getByLabel('Sort weapons').selectOption('rarity');
  await expect(row).toBeVisible();
});

