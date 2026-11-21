import { expect } from '@playwright/test';

// Log in as a smoke-test account (see docs/DECISIONS.md, Wave 0).
// 'smoketest' is the default (the DM); 'smoketest2' plays the joining player.
export async function login(page, username = 'smoketest') {
  await page.goto('/login');
  await page.getByLabel('Enter Username').fill(username);
  await page.getByLabel('Enter Password').fill(process.env.TEST_PASSWORD);
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page).toHaveURL(/\/home/);
}
