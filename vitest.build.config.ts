import { defineConfig } from 'vitest/config'
import { srcAlias } from './path-alias.config.js'

// SPEC 8.2 built-page check: reads the output of `npm run build`, so it is kept out of
// `npm test` and run by `npm run test:build` after the build.
export default defineConfig({
  resolve: { alias: srcAlias },
  test: {
    name: 'build',
    environment: 'node',
    include: ['tests/build/**/*.test.ts'],
  },
})
