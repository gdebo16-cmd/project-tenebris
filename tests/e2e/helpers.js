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

// For every required dropdown that is still empty, pick its first real option.
// One at a time, because picking one (a class, say) can fill or filter the next.
export async function fillRequiredSelects(page) {
  for (let i = 0; i < 30; i++) {
    const value = await page.evaluate(() => {
      // clear the marker from the dropdown we picked last time
      document.querySelectorAll('select[data-smoke]').forEach((s) => delete s.dataset.smoke);
      const el = [...document.querySelectorAll('select[required]')].find(
        (s) => s.offsetParent !== null && !s.disabled && s.value === '' &&
               [...s.options].some((o) => o.value && !o.disabled),
      );
      if (!el) return null;
      el.dataset.smoke = 'next';
      return [...el.options].find((o) => o.value && !o.disabled).value;
    });
    if (value === null) return;
    await page.locator('select[data-smoke="next"]').selectOption(value);
    await page.waitForLoadState('networkidle');
  }
  throw new Error('fillRequiredSelects: still finding empty dropdowns after 30 picks');
}
