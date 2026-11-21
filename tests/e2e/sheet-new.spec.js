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
