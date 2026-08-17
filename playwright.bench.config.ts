import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/benchmarks',
  testMatch: /browserPhases\.spec\.ts/,
  timeout: 180000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:3000',
    headless: true,
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: {
    command: 'npx serve out -l 3000',
    port: 3000,
    timeout: 10000,
    reuseExistingServer: true,
  },
});