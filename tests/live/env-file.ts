// SPEC 13 [1.9]: the test:live variables that may come from .env.local, and the pure
// function that picks them. vitest.live.config.ts imports both. Never prints a value.
import { parseEnv } from 'node:util'

// [1.10] The one owner of the live test file list; vitest.live.config.ts uses it.
export const LIVE_INCLUDE = ['tests/live/**/*.test.ts']

export const LIVE_ENV_NAMES = [
  'GEMINI_API_KEY',
  'FAL_KEY',
  'ADMAN_LIVE_S3_BUCKET',
  'ADMAN_LIVE_S3_REGION',
  'ADMAN_LIVE_S3_PREFIX',
  'ADMAN_LIVE_KEEP',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'DROPBOX_ACCESS_TOKEN',
] as const

// SPEC 6.5 [1.18], 14 K5: the one owner of the live values a live test removes from what it
// prints: the keys and tokens only. Bucket, region, prefix and ADMAN_LIVE_KEEP are not secrets,
// and removing them spoils other words and numbers in the output. DROPBOX_APP_SECRET is never
// read from .env.local (it is not in LIVE_ENV_NAMES); it is removed in case a terminal sets it.
export const LIVE_REDACTED_NAMES = [
  'GEMINI_API_KEY',
  'FAL_KEY',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'DROPBOX_ACCESS_TOKEN',
  'DROPBOX_APP_SECRET',
] as const

// The listed names found in the file text, except those already set (the terminal wins).
// Any other name in the text is dropped. A parse failure names the file and nothing in it.
export function liveEnvFrom(
  fileText: string,
  alreadySet: Record<string, string | undefined>,
): Record<string, string> {
  let parsed: Record<string, string | undefined>
  try {
    parsed = parseEnv(fileText)
  } catch {
    throw new Error('.env.local could not be parsed')
  }
  const picked: Record<string, string> = {}
  for (const name of LIVE_ENV_NAMES) {
    const value = parsed[name]
    if (value !== undefined && alreadySet[name] === undefined) picked[name] = value
  }
  return picked
}
