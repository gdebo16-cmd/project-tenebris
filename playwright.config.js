import { defineConfig } from '@playwright/test';

// Load TEST_PASSWORD (and friends) from the root .env
try { process.loadEnvFile('.env'); } catch {}

export default defineConfig({
  testDir: 'tests/e2e',
  use: {
    // Local Vite by default; set BASE_URL to run against staging
    baseURL: process.env.BASE_URL || 'http://localhost:5173',
  },
});
