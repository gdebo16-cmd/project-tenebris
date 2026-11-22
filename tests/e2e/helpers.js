import { readFileSync } from 'node:fs';
import { expect } from '@playwright/test';

// The smoke-test accounts (see docs/DECISIONS.md, Wave 0).
// 'smoketest' is the default (the DM); 'smoketest2' plays the joining player.
export const ACCOUNTS = ['smoketest', 'smoketest2'];

// Where global-setup.js saves each account's login (its session cookie). Not committed (.gitignore).
export const authFile = (username) => `playwright/.auth/${username}.json`;

// "Log in" a test page as an account, reusing the one login global-setup.js made for this run.
// Why not type the password each time: staging (production mode) allows only 5 logins per 15 minutes,
// and a run has ~19 tests. login.spec.js still types it once, to test the real login page.
export async function login(page, username = 'smoketest') {
  const { cookies } = JSON.parse(readFileSync(authFile(username), 'utf8'));
  await page.context().addCookies(cookies);
  await page.goto('/home');
  await expect(page).toHaveURL(/\/home/);
}
