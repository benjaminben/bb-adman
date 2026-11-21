// SPEC 14 1.56 E2E-R, "On his server": one switch per case that makes a run, terminal only.
// With none set, only Settings and Check run. ADMAN_E2E_GEMINI lets the paid confirm be
// accepted; it still needs the stakeholder's yes for that run (1.54 P-2).
// TP-6's ADMAN_E2E_VIDEO is read by videoSwitch below.
import path from 'node:path'

export type RealSwitches = { flux: boolean; moss: boolean; cancel: boolean; gemini: boolean }

type Env = Record<string, string | undefined>

export function realSwitches(env: Env): RealSwitches {
  return {
    flux: env.ADMAN_E2E_FLUX === '1',
    moss: env.ADMAN_E2E_MOSS === '1',
    cancel: env.ADMAN_E2E_CANCEL === '1',
    gemini: env.ADMAN_E2E_GEMINI === '1',
  }
}

// SPEC 14 1.57 TP-6: the video case, which leaves one clip on the server.
export function videoSwitch(env: Env): boolean {
  return env.ADMAN_E2E_VIDEO === '1'
}

export const MAX_E2E_PICTURES = 3

// One fixed line: it never names a path or how the list was written.
export const PICTURE_LIST_REFUSAL =
  'ADMAN_E2E_PICTURES takes up to 3 absolute paths, separated by commas.'

// ADMAN_E2E_PICTURES, in the comma list form of ADMAN_LIVE_REFERENCE_FILES (1.54 P-1).
export function picturePaths(value: string | undefined): string[] {
  const paths = (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item !== '')
  if (paths.length > MAX_E2E_PICTURES || paths.some((p) => !path.isAbsolute(p))) {
    throw new Error(PICTURE_LIST_REFUSAL)
  }
  return paths
}
