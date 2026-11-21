// SPEC 14 1.54 P-1, P-3: the picture case 5 sends. With ADMAN_COMFY_PICTURE set (terminal only,
// never from .env.local), the file at that absolute path, read once into memory where it is and
// never copied. Otherwise the test-made picture. All checks run here, before any server call.
// Every refusal is one fixed line: no path, no file name, and no cause, so nothing of the path
// reaches the output. Its unit test is tests/unit/config/comfy-given-picture.test.ts.
import fs from 'node:fs'
import path from 'node:path'
import { MAX_PICTURE_BYTES } from '@/main/providers/picture-limits'
import { pictureSize } from '@/main/providers/picture-size'
import { pictureType, type PictureType } from '@/main/providers/picture-type'
import { makeTestPicture, TEST_PICTURE_SIDE } from './test-picture'

// Flux keeps the reference's shape, so a large photo makes a large, slow run.
export const MAX_GIVEN_SIDE = 1_600

export type SentPicture = {
  kind: 'given' | 'test-made'
  bytes: Uint8Array
  type: PictureType
  width: number
  height: number
}

const SMALLER = 'Make a smaller copy outside the repo and give its path.'
const UNREADABLE = 'The given picture could not be read.'

const TOO_MANY_BYTES = `The given picture is over ${MAX_PICTURE_BYTES} bytes. ${SMALLER}`

// The file's size, or null when it is not a file that can be read. No error is passed on.
function fileSize(file: string): number | null {
  try {
    const stat = fs.statSync(file)
    return stat.isFile() ? stat.size : null
  } catch {
    return null
  }
}

// Checked by size before reading, so a large file is never read; checked again after, in case
// it grew in between.
function readGiven(file: string): Uint8Array {
  const size = fileSize(file)
  if (size === null) throw new Error(UNREADABLE)
  if (size > MAX_PICTURE_BYTES) throw new Error(TOO_MANY_BYTES)
  let bytes: Uint8Array
  try {
    bytes = new Uint8Array(fs.readFileSync(file))
  } catch {
    throw new Error(UNREADABLE)
  }
  if (bytes.byteLength > MAX_PICTURE_BYTES) throw new Error(TOO_MANY_BYTES)
  return bytes
}

function testMade(): SentPicture {
  const bytes = makeTestPicture()
  const side = TEST_PICTURE_SIDE
  return { kind: 'test-made', bytes, type: 'image/png', width: side, height: side }
}

export function pictureToSend(env: Record<string, string | undefined>): SentPicture {
  const value = env.ADMAN_COMFY_PICTURE?.trim() ?? ''
  if (value === '') return testMade()
  if (!path.isAbsolute(value)) throw new Error('ADMAN_COMFY_PICTURE must be an absolute path.')
  const bytes = readGiven(value)
  const type = pictureType(bytes)
  if (!type) throw new Error('The given picture is not a PNG or a JPEG.')
  let size: { width: number; height: number }
  try {
    size = pictureSize(bytes, type)
  } catch {
    throw new Error('The pixel size of the given picture could not be read.')
  }
  if (Math.max(size.width, size.height) > MAX_GIVEN_SIDE) {
    throw new Error(`The given picture is over 1,600 px on its long side. ${SMALLER}`)
  }
  return { kind: 'given', bytes, type, ...size }
}
