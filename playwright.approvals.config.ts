import { defineConfig } from '@playwright/test'

// AP-13, the local proof: the real approvals service under `next start` on 127.0.0.1 with a
// local database file, the built app beside it, and Playwright's Chromium as the visitor. Run
// `npm run test:approvals-local`; no CI workflow runs it. No trace, screenshot or video is kept,
// so no key or password typed in the run lands in a file.
export default defineConfig({
  testDir: 'tests/approvals-local',
  testMatch: '**/*.spec.ts',
  globalSetup: './tests/approvals-local/global-setup.ts',
  timeout: 300_000,
  workers: 1,
  reporter: 'list',
  use: { browserName: 'chromium', trace: 'off', screenshot: 'off', video: 'off' },
})
