import { defineConfig } from 'vitest/config'

// D10 packaged check: reads the app that `npm run package:dir` made, so it is kept out of
// `npm test` and `npm run test:build`. It reads files only and never starts the app.
export default defineConfig({
  test: {
    name: 'package',
    environment: 'node',
    include: ['tests/package/**/*.test.ts'],
  },
})
