// SPEC 6.10.12, 13 [1.24]: the one variable test:comfy may take from .env.local, and the pure
// function that picks it. vitest.comfy.config.ts imports both. Never prints a value.
// COMFY_BASE_URL is not in LIVE_ENV_NAMES and this file takes nothing from that list, so the
// ComfyUI run can never load a paid key. ADMAN_COMFY_VIDEO, ADMAN_COMFY_FLUX, ADMAN_COMFY_MOSS
// and ADMAN_COMFY_PICTURE are terminal only (1.53 G-12, 1.54 P-1).
import { parseEnv } from 'node:util'

// The one owner of the comfy test file list; vitest.comfy.config.ts uses it.
export const COMFY_INCLUDE = ['tests/comfy/**/*.test.ts']

export const COMFY_ENV_NAMES = ['COMFY_BASE_URL'] as const

// The listed name found in the file text, unless already set (the terminal wins). Any other
// name in the text is dropped. A parse failure names the file and nothing in it.
export function comfyEnvFrom(
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
  for (const name of COMFY_ENV_NAMES) {
    const value = parsed[name]
    if (value !== undefined && alreadySet[name] === undefined) picked[name] = value
  }
  return picked
}
