import fs from 'node:fs'
import { defineConfig } from 'vitest/config'
import { COMFY_INCLUDE, comfyEnvFrom } from './tests/comfy/env-file.js'

// SPEC 6.10.12, 13 [1.24]: hand-run tests against the project's ComfyUI test server. Kept out
// of `npm test`, the build and CI; run with `npm run test:comfy`. COMFY_BASE_URL may come from
// .env.local in the project root; no file is not an error. No value is ever printed.
// The 1.10 rules: loading this file reads nothing. .env.local is read only inside the
// function below, which only Vitest calls, when started with --config vitest.comfy.config.ts.
function readEnvLocal(): string {
  try {
    return fs.readFileSync(new URL('./.env.local', import.meta.url), 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return ''
    throw new Error('.env.local could not be read', { cause: error })
  }
}

export default defineConfig(() => ({
  test: {
    name: 'comfy',
    environment: 'node',
    include: COMFY_INCLUDE,
    // One case at a time: the server is the stakeholder's own machine.
    fileParallelism: false,
    sequence: { concurrent: false },
    env: comfyEnvFrom(readEnvLocal(), process.env),
  },
}))
