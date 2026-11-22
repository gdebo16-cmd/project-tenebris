// Runs once before all the tests: logs each test account in one time and saves its session cookie,
// so every test reuses it (helpers.js login). Staging allows only 5 logins per 15 minutes; a run now uses 3
// (these two, plus login.spec.js typing the password once).
import { mkdirSync } from 'node:fs';
import { request } from '@playwright/test';
import { ACCOUNTS, authFile } from './helpers.js';

export default async function globalSetup(config) {
  const baseURL = config.projects[0].use.baseURL;
  mkdirSync('playwright/.auth', { recursive: true });
  for (const username of ACCOUNTS) {
    const api = await request.newContext({ baseURL });
    const res = await api.post('/api/login', { data: { username, password: process.env.TEST_PASSWORD } });
    if (!res.ok()) {
      throw new Error(`Logging in ${username} failed (${res.status()}): ${await res.text()}. ` +
        'On staging, a refused login (429) means the 5-per-15-minutes limit: wait 15 minutes and run again.');
    }
    await api.storageState({ path: authFile(username) });
    await api.dispose();
  }
}
