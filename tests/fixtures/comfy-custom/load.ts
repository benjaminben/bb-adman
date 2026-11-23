// The small API-format workflows made for the custom workflow tests (D-104). None is a copy
// of a reference file (D-062).
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export type CustomFixture =
  | 'picture'
  | 'two-refs'
  // Its seed step is fed only by the second picture, so it needs both.
  | 'two-refs-both'
  | 'video-prompt'
  | 'video-first-frame'
  | 'video-refs'
  | 'canvas'

export function fixtureText(name: CustomFixture): string {
  return readFileSync(join(import.meta.dirname, `${name}.json`), 'utf8')
}
