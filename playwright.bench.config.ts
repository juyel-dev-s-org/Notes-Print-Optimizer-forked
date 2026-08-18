import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/benchmarks',
  testMatch: /(browserPhases|pipelineScale|kernelHeadToHead|bufferMemory|abWasm|fusedMemory|realPdfBaseline|v1VsV2|hundredPageReal)\.spec\.ts/,
  timeout: 180000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:3000',
    headless: true,
  },
  projects: [{
    name: 'chromium',
    use: {
      browserName: 'chromium',
      launchOptions: { args: ['--enable-precise-memory-info', '--js-flags=--expose-gc'] },
    },
  }],
  webServer: {
    command: 'npx serve out -l 3000',
    port: 3000,
    timeout: 10000,
    reuseExistingServer: true,
  },
});