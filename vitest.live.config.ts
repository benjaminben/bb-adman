import { defineConfig } from 'vitest/config'

// SPEC 10.2, 13: hand-run tests against real providers, with the developer's own keys.
// Kept out of `npm test` and CI; run with `npm run test:live`.
export default defineConfig({
  test: {
    name: 'live',
    environment: 'node',
    include: ['tests/live/**/*.test.ts'],
  },
})
