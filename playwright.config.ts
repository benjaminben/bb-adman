import { defineConfig } from '@playwright/test'

// End-to-end tests drive the built Electron app (SPEC 10.1). Run `npm run test:e2e`.
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  workers: 1,
  reporter: 'list',
})
