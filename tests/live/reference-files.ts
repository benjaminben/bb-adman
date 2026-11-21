// SPEC 14 [1.46], OI-79: optional reference picture files for the live Gemini reference case,
// named in ADMAN_LIVE_REFERENCE_FILES (from the terminal only; not one of LIVE_ENV_NAMES, so
// .env.local never supplies it). Paths are separated by commas, relative to the project root
// or absolute. The files are read where they are; nothing is copied.
// A refusal names the file's place in the list, never its path, and the error has no cause,
// so no path reaches the output. Not a test file itself; its unit test is
// tests/unit/live/reference-files.test.ts.
import fs from 'node:fs'
import path from 'node:path'
import { pictureType } from '../../src/main/providers/picture-type'
import type { PictureType } from '../../src/main/providers/picture-type'

export const MAX_REFERENCE_FILES = 3

export type ReferenceFile = { bytes: Uint8Array; mime: PictureType }

function readAt(file: string, place: number): Uint8Array {
  try {
    return new Uint8Array(fs.readFileSync(file))
  } catch {
    throw new Error(`Reference file ${place} could not be read`)
  }
}

// The pictures in the order given, or undefined when the value is not set or is empty.
export function referenceFiles(
  value: string | undefined,
  root: string,
): ReferenceFile[] | undefined {
  const names = (value ?? '')
    .split(',')
    .map((name) => name.trim())
    .filter((name) => name !== '')
  if (names.length === 0) return undefined
  if (names.length > MAX_REFERENCE_FILES) {
    throw new Error(
      `ADMAN_LIVE_REFERENCE_FILES names ${names.length} files; ` +
        `at most ${MAX_REFERENCE_FILES} are allowed`,
    )
  }
  return names.map((name, index) => {
    const bytes = readAt(path.resolve(root, name), index + 1)
    const mime = pictureType(bytes)
    if (!mime) throw new Error(`Reference file ${index + 1} is not a PNG or a JPEG`)
    return { bytes, mime }
  })
}
