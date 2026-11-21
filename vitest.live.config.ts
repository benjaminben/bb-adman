import fs from 'node:fs'
import { defineConfig } from 'vitest/config'
import { liveEnvFrom } from './tests/live/env-file'

// SPEC 10.2, 13: hand-run tests against real providers, with the developer's own keys.
// Kept out of `npm test` and CI; run with `npm run test:live`.
// [1.9] The listed variables may come from .env.local in the project root. No file is not an
// error. No value from the file is ever printed; a failure names the file only.
function readEnvLocal(): string {
  try {
    return fs.readFileSync(new URL('./.env.local', import.meta.url), 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return ''
    throw new Error('.env.local could not be read', { cause: error })
  }
}

export default defineConfig({
  test: {
    name: 'live',
    environment: 'node',
    include: ['tests/live/**/*.test.ts'],
    env: liveEnvFrom(readEnvLocal(), process.env),
  },
})
