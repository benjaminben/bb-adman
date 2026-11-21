import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { readPicture, type PictureConverters } from '@/main/assets/read-picture'
import { AppError } from '@/shared/schemas/result'
import { vp8l, vp8x, webp } from '../../fixtures/webp-bytes'

let root: string
const LIMIT = 1000

// A PNG header that states the given size: signature, IHDR length and type, width, height.
function pngHead(width: number, height: number, extra = 0): Uint8Array {
  const bytes = new Uint8Array(24 + extra)
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52])
  const view = new DataView(bytes.buffer)
  view.setUint32(16, width)
  view.setUint32(20, height)
  return bytes
}

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0])
const CLEAN = pngHead(1, 1, 4).fill(7, 24)
const WEBP = webp(vp8x(20, 10, true))

function place(bytes: Uint8Array): string {
  const file = path.join(root, 'secret-folder', 'pic.bin')
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, bytes)
  return file
}

function converters(decoded: () => Uint8Array = () => pngHead(20, 10)) {
  return {
    toPng: vi.fn((_bytes: Uint8Array): Uint8Array => CLEAN),
    webpToPng: vi.fn(async (_bytes: Uint8Array) => decoded()),
  } satisfies PictureConverters
}

async function refusal(promise: Promise<unknown>): Promise<ReturnType<AppError['toBody']>> {
  const error = await promise.catch((e: unknown) => e)
  expect(error).toBeInstanceOf(AppError)
  const body = (error as AppError).toBody()
  expect(JSON.stringify(body)).not.toContain(root)
  return body
}

const read = (bytes: Uint8Array, convert: PictureConverters) =>
  readPicture(place(bytes), 'photo.webp', LIMIT, convert)

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-read-convert-'))
})
afterEach(() => fs.rmSync(root, { recursive: true, force: true }))

describe('readPicture hands on a clean PNG [Slice WP; ruling F-9]', () => {
  it('turns a WebP into a PNG: decoded in the window, then through toPng', async () => {
    const convert = converters()
    expect(await read(WEBP, convert)).toEqual({ bytes: CLEAN, mime: 'image/png' })
    expect(convert.webpToPng).toHaveBeenCalledWith(WEBP)
    expect(convert.toPng).toHaveBeenCalledWith(pngHead(20, 10))
  })

  it.each([
    ['PNG', pngHead(3, 3)],
    ['JPEG', JPEG],
  ])('passes a %s through toPng only, and gives image/png', async (_name, bytes) => {
    const convert = converters()
    expect(await read(bytes, convert)).toEqual({ bytes: CLEAN, mime: 'image/png' })
    expect(convert.toPng).toHaveBeenCalledWith(bytes)
    expect(convert.webpToPng).not.toHaveBeenCalled()
  })

  it.each([
    ['a broken WebP header', webp(vp8x(20, 10, true)).slice(0, 25)],
    ['a WebP side over 8192', webp(vp8l(8193, 1))],
    ['a WebP over 24 million pixels', webp(vp8x(6000, 4001, false))],
  ])('refuses %s with asset_not_a_picture and never calls the window', async (_name, bytes) => {
    const convert = converters()
    const body = await refusal(read(bytes, convert))
    expect(body.details).toEqual({ reason: 'asset_not_a_picture' })
    expect(convert.webpToPng).not.toHaveBeenCalled()
  })

  it.each([
    ['the window fails', () => Promise.reject(new Error('crashed'))],
    ['the window gives a JPEG', () => Promise.resolve(JPEG)],
    ['the window gives a PNG of another size', () => Promise.resolve(pngHead(20, 11))],
    ['the window gives nothing', () => Promise.resolve(new Uint8Array(0))],
  ])('refuses with asset_not_a_picture when %s', async (_name, answer) => {
    const convert = converters()
    convert.webpToPng.mockImplementation(answer)
    const body = await refusal(read(WEBP, convert))
    expect(body).toEqual({
      code: 'RULE_VIOLATION',
      message: 'photo.webp is not a picture the app can send.',
      details: { reason: 'asset_not_a_picture' },
    })
    expect(convert.toPng).not.toHaveBeenCalled()
  })

  it.each([
    [
      'toPng throws',
      WEBP,
      () => {
        throw new Error('The picture could not be turned into a PNG')
      },
    ],
    [
      'toPng throws on a PNG',
      pngHead(3, 3),
      () => {
        throw new Error('no')
      },
    ],
    ['toPng gives a JPEG', JPEG, () => JPEG],
  ])('refuses with asset_not_a_picture when %s', async (_name, bytes, toPng) => {
    const convert = converters()
    convert.toPng.mockImplementation(toPng)
    const body = await refusal(read(bytes, convert))
    expect(body.details).toEqual({ reason: 'asset_not_a_picture' })
  })

  it('refuses a decoded PNG over the byte limit with asset_too_large, before toPng', async () => {
    const convert = converters(() => pngHead(20, 10, LIMIT))
    const body = await refusal(read(WEBP, convert))
    expect(body.details).toEqual({ reason: 'asset_too_large' })
    expect(convert.toPng).not.toHaveBeenCalled()
  })

  it.each([
    ['a WebP', WEBP],
    ['a JPEG', JPEG],
  ])(
    'refuses %s whose clean PNG is over the byte limit with asset_too_large',
    async (_n, bytes) => {
      const convert = converters()
      convert.toPng.mockImplementation(() => pngHead(1, 1, LIMIT))
      const body = await refusal(read(bytes, convert))
      expect(body.details).toEqual({ reason: 'asset_too_large' })
    },
  )

  it('never changes the user file', async () => {
    const file = place(WEBP)
    await readPicture(file, 'photo.webp', LIMIT, converters())
    expect(new Uint8Array(fs.readFileSync(file))).toEqual(WEBP)
  })
})
