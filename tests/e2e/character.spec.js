import { test, expect } from '@playwright/test';
import { login, fillRequiredSelects } from './helpers.js';

test('creates a character, opens its sheet and rolls', async ({ page }) => {
  const name = `Smoke ${Date.now()}`; // unique, so reruns never collide
  await login(page);

  // Step 1: name + species
  await page.goto('/create_char');
  await page.getByLabel('Character name').fill(name);
  await fillRequiredSelects(page);
  await page.getByRole('button', { name: 'Next: Class' }).click();
  await expect(page).toHaveURL(/\/create_char\/step2/);

  // Step 2: level, class, calling, gear, skills
  await fillRequiredSelects(page);
  await page.getByRole('button', { name: 'Next: Abilities' }).click();
  await expect(page).toHaveURL(/\/create_char\/step3/);

  // Step 3: +2 and +1 on different stats, then roll every ability
  await page.locator('#plus2').selectOption({ index: 1 });
  await page.locator('#plus1').selectOption({ index: 2 });
  const rollButtons = page.getByRole('button', { name: 'roll', exact: true });
  while (await rollButtons.count() > 0) {
    await rollButtons.first().click();
    await page.waitForLoadState('networkidle');
  }
  await fillRequiredSelects(page);
  await page.getByRole('button', { name: 'Next: Background' }).click();
  await expect(page).toHaveURL(/\/create_char\/step4/);

  // Step 4: alignment, magic picks, race element + spell
  await page.getByRole('radio').first().click();
  await fillRequiredSelects(page);
  await page.getByRole('button', { name: 'Create Character' }).click();
  await expect(page).toHaveURL(/\/home/);

  // The sheet: the new character is listed on Home and its sheet opens
  await page.getByText(name).click();
  await expect(page).toHaveURL(/\/characters\/\d+$/);
  await expect(page.getByText(name).first()).toBeVisible();

  // Roll: every new character has a starting weapon, so click its to-hit button
  // and check the roll shows up in the roll panel.
  await page.locator('.btn-to-hit').first().click();
  await page.getByLabel('Open Roll Panel').click();
  await expect(page.locator('.roll-bubble.is-sent').first()).toBeVisible();
});
