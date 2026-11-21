// SPEC 14 1.56 E2E-R: the one place test:e2e:real reads its settings. COMFY_BASE_URL comes
// from the terminal or .env.local (the terminal wins), through the same picker as
// test:comfy, so no other name in the file is taken. Playwright calls this function once,
// before any worker starts; the workers inherit what it sets. No value is ever printed.
// The 1.10 rules: loading this file reads nothing; .env.local is read only inside the
// function below. Not a test file itself.
import fs from 'node:fs'
import type { FullConfig } from '@playwright/test'
import { comfyEnvFrom } from '../comfy/env-file'
import { commandRefusal, runRefusal, RUN_CHECKED } from './run-checks'

function readEnvLocal(): string {
  try {
    return fs.readFileSync(new URL('../../.env.local', import.meta.url), 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return ''
    // As vitest.comfy.config.ts: the cause is the file system's own error, which names the
    // file and holds none of its text.
    throw new Error('.env.local could not be read', { cause: error })
  }
}

export default function setUp(config: FullConfig): void {
  // 1.59 L-11: before anything is read, refuse a run that could record a typed value. The
  // re-review's R-3: a test-server run is refused by its command line, and the workers check
  // again, which they do only after this setup has passed and set RUN_CHECKED.
  delete process.env[RUN_CHECKED]
  const refusal = runRefusal(config, process.env) ?? commandRefusal(process.argv, process.env)
  if (refusal !== null) throw new Error(refusal)
  process.env[RUN_CHECKED] = '1'
  Object.assign(process.env, comfyEnvFrom(readEnvLocal(), process.env))
  // A failed test would otherwise get an aria snapshot of the window, which on Settings or
  // the campaign screen holds the address or a photo's file name, written to test-results.
  process.env.PLAYWRIGHT_NO_COPY_PROMPT = '1'
}
