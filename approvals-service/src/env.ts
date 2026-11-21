// The Worker's environment (spec/approvals-service.md "What it is"). API_KEY is a secret set
// with Wrangler when deploying; it is never written into wrangler.jsonc. TEST_PICTURE_ORIGIN is
// set only by the tests ("Pictures"), never in wrangler.jsonc and never by a deploy step.
import type { Db } from './db/client'

export type Env = {
  DB: Db
  API_KEY?: string
  TEST_PICTURE_ORIGIN?: string
}

export const API_KEY_MIN_LENGTH = 32

// The key, or null when it is missing or too short to be safe: the service is then not set up.
export function apiKeyOf(env: Env): string | null {
  const key = env.API_KEY
  return typeof key === 'string' && key.length >= API_KEY_MIN_LENGTH ? key : null
}

const TEST_ORIGIN = /^http:\/\/127\.0\.0\.1:[1-9][0-9]{0,4}$/

// The test picture origin, or null unless the value is exactly `http://127.0.0.1:{port}`.
export function testPictureOriginOf(env: Env): string | null {
  const origin = env.TEST_PICTURE_ORIGIN
  return typeof origin === 'string' && TEST_ORIGIN.test(origin) ? origin : null
}
