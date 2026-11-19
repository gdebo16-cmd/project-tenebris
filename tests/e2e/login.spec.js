import { test, expect } from '@playwright/test';

test('logs in', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Enter Username').fill('smoketest');
  await page.getByLabel('Enter Password').fill(process.env.TEST_PASSWORD);
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page).toHaveURL(/\/home/);
});
