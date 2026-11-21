// SPEC 13 [1.9]: the test:live variables that may come from .env.local, and the pure
// function that picks them. vitest.live.config.ts imports both. Never prints a value.
import { parseEnv } from 'node:util'

export const LIVE_ENV_NAMES = [
  'GEMINI_API_KEY',
  'FAL_KEY',
  'ADMAN_LIVE_S3_BUCKET',
  'ADMAN_LIVE_S3_REGION',
  'ADMAN_LIVE_S3_PREFIX',
  'ADMAN_LIVE_KEEP',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
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
