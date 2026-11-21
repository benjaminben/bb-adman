import { defineConfig } from '@playwright/test'

// Screenshots of the built app's screens, for review by eye. Run `npm run shots`; the
// pictures land in `shots/` (not in git). Not part of any routine check.
export default defineConfig({
  testDir: 'tests/shots',
  testMatch: '**/*.shots.ts',
  timeout: 120_000,
  workers: 1,
  reporter: 'list',
})
