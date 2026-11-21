import fs from 'node:fs'
import { defineConfig } from 'vitest/config'
import { srcAlias } from './path-alias.config.js'
import { LIVE_INCLUDE, liveEnvFrom } from './tests/live/env-file.js'

// SPEC 10.2, 13: hand-run tests against real providers, with the developer's own keys.
// Kept out of `npm test` and CI; run with `npm run test:live`.
// [1.9] The listed variables may come from .env.local in the project root. No file is not an
// error. No value from the file is ever printed; a failure names the file only.
// [1.10] Loading this file reads nothing: .env.local is read only inside the function below,
// which only Vitest calls, when started with --config vitest.live.config.ts.
// [1.18] K6: env-file is imported with an extension, so Vite's config loader gives no warning.
// TypeScript resolves the `.js` name to env-file.ts, so typecheck needs no extra option.
function readEnvLocal(): string {
  try {
    return fs.readFileSync(new URL('./.env.local', import.meta.url), 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return ''
    throw new Error('.env.local could not be read', { cause: error })
  }
}

export default defineConfig(() => ({
  resolve: { alias: srcAlias },
  test: {
    name: 'live',
    environment: 'node',
    include: LIVE_INCLUDE,
    env: liveEnvFrom(readEnvLocal(), process.env),
  },
}))
