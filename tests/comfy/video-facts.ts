// SPEC 14 1.58 J-1: case 2 passes its clip through the app's own checkMp4, as built, and prints
// what it read, so a surprise in a real clip's layout shows before the hand test. A refusal
// fails the case with the refusal's name from MP4_REFUSED: fixed text, never the file's.
import { checkMp4, MP4_REFUSED, type Mp4Details } from '../../src/main/providers/video-check'
import type { Print } from './print'

const NOT_READ = 'not read'

const shown = (value: number | undefined, unit = '') =>
  value === undefined ? NOT_READ : `${value}${unit}`

const sound = (value: boolean | undefined) =>
  value === undefined ? NOT_READ : value ? 'yes' : 'no'

export function clipFactLines(facts: Partial<Mp4Details>): string[] {
  return [
    `Clip width: ${shown(facts.width)}`,
    `Clip height: ${shown(facts.height)}`,
    `Clip duration: ${shown(facts.durationMs, ' ms')}`,
    `Clip sound: ${sound(facts.hasSound)}`,
  ]
}

// The refusal's name, found by its fixed message; anything else is "unknown".
function reasonOf(error: unknown): string {
  const message = error instanceof Error ? error.message : ''
  const found = Object.entries(MP4_REFUSED).find(([, text]) => text === message)
  return found ? found[0] : 'unknown'
}

export function checkClip(bytes: Uint8Array, print: Print): void {
  let facts: Mp4Details
  try {
    facts = checkMp4(bytes)
  } catch (error) {
    const line = `checkMp4 refused the clip: ${reasonOf(error)}`
    print(line)
    throw new Error(line, { cause: error })
  }
  print(...clipFactLines(facts))
}
