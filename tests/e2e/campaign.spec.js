import { test, expect } from '@playwright/test';
import { login } from './helpers.js';

test('a DM creates a tale and a player joins it', async ({ browser }) => {
  // Two separate browsers = two separate logins, like two real people.
  const dm = await (await browser.newContext()).newPage();
  const player = await (await browser.newContext()).newPage();

  // DM creates the tale
  await login(dm, 'smoketest');
  await dm.goto('/create_campaign');
  await dm.getByLabel('Tale Name').fill(`Smoke Test Campaign ${Date.now()}`);
  await dm.getByLabel('Description').fill('Created by the smoke tests.');
  await dm.getByRole('button', { name: 'Create Tale' }).click();
  await expect(dm).toHaveURL(/\/campaign\/\d+/);
  const tale = dm.url();

  // DM reads the invite code. On narrow screens it sits behind an "Invite / Join" tab;
  // on desktop width it is already showing.
  const inviteTab = dm.getByRole('button', { name: 'Invite / Join' });
  if (await inviteTab.isVisible()) await inviteTab.click();
  const code = (await dm.getByText('Invite code', { exact: true }).locator('xpath=following-sibling::p[1]').textContent()).trim();
  expect(code).not.toBe('');

  // Player joins with the code and lands on the same tale
  await login(player, 'smoketest2');
  await player.goto(`/join/${code}`);
  await expect(player).toHaveURL(tale);
});
