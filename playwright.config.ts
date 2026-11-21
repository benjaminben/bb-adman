import { defineConfig } from '@playwright/test'

// End-to-end tests drive the built Electron app (SPEC 10.1). Run `npm run test:e2e`.
export default defineConfig({
  testDir: 'tests/e2e',
  // Three minutes: several agents use this machine at once, and a busy machine must not fail a
  // correct test. A test that passes is not slowed.
  timeout: 180_000,
  workers: 1,
  reporter: 'list',
})
