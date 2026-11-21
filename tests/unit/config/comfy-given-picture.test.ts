import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it, expect, afterEach } from 'vitest'
import { MAX_PICTURE_BYTES } from '../../../src/main/providers/picture-limits'
import { makeTestPicture } from '../../comfy/test-picture'
import { MAX_GIVEN_SIDE, pictureToSend } from '../../comfy/given-picture'

const dirs: string[] = []
afterEach(() => {
  for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true })
})

const FILE_NAME = 'secret-holiday-photo'

// Writes bytes to a file in a new temp folder and returns its absolute path.
function fileOf(bytes: Uint8Array, ext = '.png'): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-given-'))
  dirs.push(dir)
  const file = path.join(dir, `${FILE_NAME}${ext}`)
  fs.writeFileSync(file, bytes)
  return file
}

// A PNG signature and an IHDR chunk: enough for the type and the pixel size.
function pngHead(width: number, height: number): Uint8Array {
  const bytes = Buffer.alloc(33)
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0)
  bytes.writeUInt32BE(13, 8)
  bytes.write('IHDR', 12, 'ascii')
  bytes.writeUInt32BE(width, 16)
  bytes.writeUInt32BE(height, 20)
  return new Uint8Array(bytes)
}

// A JPEG start and a baseline frame header with its height and width.
function jpegHead(width: number, height: number): Uint8Array {
  const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xc0, 0, 17, 8, 0, 0, 0, 0, 3, 1, 0x22, 0, 0, 0])
  bytes.writeUInt16BE(height, 7)
  bytes.writeUInt16BE(width, 9)
  return new Uint8Array(bytes)
}

// The refusal's message, checked to carry no path, no file name and no cause.
function refusal(value: string): string {
  let caught: unknown
  try {
    pictureToSend({ ADMAN_COMFY_PICTURE: value })
  } catch (error) {
    caught = error
  }
  if (!(caught instanceof Error)) throw new Error('No refusal')
  expect(caught.cause).toBeUndefined()
  expect(caught.message).not.toContain(FILE_NAME)
  expect(caught.message).not.toContain(os.tmpdir())
  expect(caught.message).not.toContain(value)
  return caught.message
}

const SMALLER = 'Make a smaller copy outside the repo and give its path.'

describe('the picture case 5 sends [SPEC 14 1.54 P-1, P-3]', () => {
  it('is the test-made picture when ADMAN_COMFY_PICTURE is not set or is blank', () => {
    for (const env of [{}, { ADMAN_COMFY_PICTURE: '' }, { ADMAN_COMFY_PICTURE: '  ' }]) {
      const sent = pictureToSend(env)
      expect(sent).toMatchObject({ kind: 'test-made', type: 'image/png', width: 768, height: 768 })
      expect(Buffer.from(sent.bytes).equals(Buffer.from(makeTestPicture()))).toBe(true)
    }
  })

  it('is the given PNG, read where it is, with its type and pixel size', () => {
    const bytes = pngHead(1_600, 900)
    const sent = pictureToSend({ ADMAN_COMFY_PICTURE: fileOf(bytes) })
    expect(sent).toMatchObject({ kind: 'given', type: 'image/png', width: 1_600, height: 900 })
    expect(Buffer.from(sent.bytes).equals(Buffer.from(bytes))).toBe(true)
  })

  it('is the given JPEG, whatever its file name ends with', () => {
    const bytes = jpegHead(800, 1_200)
    const sent = pictureToSend({ ADMAN_COMFY_PICTURE: fileOf(bytes, '.png') })
    expect(sent).toMatchObject({ kind: 'given', type: 'image/jpeg', width: 800, height: 1_200 })
  })

  it('refuses a path that is not absolute', () => {
    expect(refusal(`some-folder/${FILE_NAME}.png`)).toBe(
      'ADMAN_COMFY_PICTURE must be an absolute path.',
    )
  })

  it('refuses a file that cannot be read, or a folder', () => {
    const missing = path.join(os.tmpdir(), `${FILE_NAME}-not-there.png`)
    expect(refusal(missing)).toBe('The given picture could not be read.')
    const folder = path.dirname(fileOf(pngHead(10, 10)))
    expect(refusal(folder)).toBe('The given picture could not be read.')
  })

  it('refuses a file over MAX_PICTURE_BYTES, without reading it', () => {
    const file = fileOf(pngHead(10, 10))
    fs.truncateSync(file, MAX_PICTURE_BYTES + 1)
    expect(refusal(file)).toBe(`The given picture is over ${MAX_PICTURE_BYTES} bytes. ${SMALLER}`)
  })

  it('refuses bytes that are not a PNG or a JPEG', () => {
    const file = fileOf(new TextEncoder().encode('GIF89a not a picture we take'), '.jpg')
    expect(refusal(file)).toBe('The given picture is not a PNG or a JPEG.')
  })

  it('refuses a JPEG whose pixel size cannot be read', () => {
    const file = fileOf(new Uint8Array([0xff, 0xd8, 0xff, 0x00, 0x01, 0x02]), '.jpg')
    expect(refusal(file)).toBe('The pixel size of the given picture could not be read.')
  })

  it('refuses a picture over 1,600 px on its long side, either way round', () => {
    expect(MAX_GIVEN_SIDE).toBe(1_600)
    const tooLong = `The given picture is over 1,600 px on its long side. ${SMALLER}`
    expect(refusal(fileOf(pngHead(1_601, 400)))).toBe(tooLong)
    expect(refusal(fileOf(jpegHead(400, 1_601), '.jpg'))).toBe(tooLong)
  })
})
