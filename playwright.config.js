import { defineConfig } from '@playwright/test';

// Load TEST_PASSWORD (and friends) from the root .env
try { process.loadEnvFile('.env'); } catch {}

export default defineConfig({
  testDir: 'tests/e2e',
  // Logs each test account in once per run (staging allows 5 logins per 15 minutes)
  globalSetup: './tests/e2e/global-setup.js',
  use: {
    // Local Vite by default; set BASE_URL to run against staging
    baseURL: process.env.BASE_URL || 'http://localhost:5173',
  },
});
