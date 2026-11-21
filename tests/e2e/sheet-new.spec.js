import { test, expect } from '@playwright/test';
import { login } from './helpers.js';

// The new block sheet (R5) behind ?new=1: it loads from /api/sheets, and a to-hit roll comes back from the server.
test('new sheet: loads and rolls through the server', async ({ page }) => {
  await login(page);
  // Any finished character of the test account will do
  const home = await (await page.request.get('/api/home')).json();
  test.skip(!home.characters?.length, 'The test account has no finished character');
  const id = home.characters[0].id;

  await page.goto(`/characters/${id}?new=1`);
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

  // A spell that isn't learned can't be unprepared: the same shared rule answers on the new route and the old one
  const notLearned = { op: 'unprepare', spellId: 999999 };
  const newRoute = await page.request.post(`${base}/spellbook`, { data: notLearned });
  expect(newRoute.status()).toBe(400);
  expect((await newRoute.json()).error).toBe('You have to learn that spell first');
  const oldRoute = await page.request.post(`/api/characters/${id}/spells/unprepare`, { data: { spell_id: 999999 } });
  expect(oldRoute.status()).toBe(400);

  // The spell book loads for the owner
  const book = await page.request.get(`${base}/spellbook`);
  expect(book.status()).toBe(200);
  expect(Array.isArray((await book.json()).learnedSpells)).toBe(true);

  // A long rest from the sheet: the server's answer lands in the roll feed
  await page.goto(`/characters/${id}?new=1`);
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

  await page.goto(`/characters/${id}?new=1`);
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