import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 90000,
  workers: 1,
  use: { baseURL: 'http://localhost:3000', channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome', trace: 'retain-on-failure' },
  webServer: [
    { command: 'npm run dev -w worker -- --var INSIGHTS_READ_TOKEN:local-browser-test-only-key-32-characters --var ADMIN_PASSWORD:local-browser-admin-test-only-key-32-characters', url: 'http://localhost:8787/insights/report', reuseExistingServer: false, timeout: 60000 },
    { command: 'npm run dev -w frontend -- --host localhost', url: 'http://localhost:3000', reuseExistingServer: false, timeout: 30000 },
  ],
})
