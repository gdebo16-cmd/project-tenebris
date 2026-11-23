import { defineConfig } from '@playwright/test';

// Load TEST_PASSWORD (and friends) from the root .env
try { process.loadEnvFile('.env'); } catch {}

export default defineConfig({
  testDir: 'tests/e2e',
  // Logs each test account in once per run (staging allows 5 logins per 15 minutes)
  globalSetup: './tests/e2e/global-setup.js',
  // Against staging (BASE_URL set): fewer tests at once and more time each. Staging is a small free
  // server: ten browsers at once queue up there and the first ones run past 30 seconds.
  workers: process.env.BASE_URL ? 2 : undefined,
  timeout: process.env.BASE_URL ? 60_000 : 30_000,
  use: {
    // Local Vite by default; set BASE_URL to run against staging
    baseURL: process.env.BASE_URL || 'http://localhost:5173',
  },
});
