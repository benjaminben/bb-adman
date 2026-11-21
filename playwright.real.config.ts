import { defineConfig } from '@playwright/test'

// SPEC 14 1.56 E2E-R: the built app driven through its screens on the stakeholder's real
// ComfyUI server. Run by hand only, with `npm run test:e2e:real`; no CI workflow names it.
// Playwright takes only an object here, not a function, so COMFY_BASE_URL is read inside the
// global setup function instead. Nothing is kept that could hold the address or a path:
// no trace, screenshot or video, and the list reporter only.
export default defineConfig({
  testDir: 'tests/e2e-real',
  globalSetup: './tests/e2e-real/global-setup.ts',
  // A real run can wait in the server's queue; each case sets its own limit.
  timeout: 5 * 60_000,
  // Review S-2: a missing element fails inside its step's guard, well before the case's limit.
  // A wait that is meant to be long (a run in the queue) sets its own timeout.
  expect: { timeout: 60_000 },
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: { trace: 'off', screenshot: 'off', video: 'off', actionTimeout: 60_000 },
})
