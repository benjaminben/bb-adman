import zlib from 'node:zlib'
import { describe, it, expect } from 'vitest'
import { adapters } from '@/main/providers/fake'
import { greyPng } from '@/main/providers/fake/png'
import type { AdapterContext, CutoutProvider, RunOptions } from '@/main/providers/types'
import { describeSwitches } from './fake-switches'

const ctx = {} as AdapterContext
const cutout = (): CutoutProvider => {
  const build = adapters.cutout
  if (!build) throw new Error('fake has no cutout part')
  return build(ctx)
}
const input = { image: { bytes: greyPng(40, 30), mime: 'image/png' } }
const cut = (opts?: RunOptions) => cutout().cutOut(input, opts)

// Reads an 8-bit RGBA PNG whose rows all use filter 0, as the fake writes it.
function decode(bytes: Uint8Array) {
  const buf = Buffer.from(bytes)
  const width = buf.readUInt32BE(16)
  const height = buf.readUInt32BE(20)
  const colourType = buf[25]
  const idat: Buffer[] = []
  for (let at = 8; at < buf.length;) {
    const length = buf.readUInt32BE(at)
    if (buf.toString('ascii', at + 4, at + 8) === 'IDAT') {
      idat.push(buf.subarray(at + 8, at + 8 + length))
    }
    at += 12 + length
  }
  const raw = zlib.inflateSync(Buffer.concat(idat))
  const alpha = (x: number, y: number) => raw[y * (width * 4 + 1) + 1 + x * 4 + 3]
  return { width, height, colourType, alpha }
}

describe('fake provider, cut-out [spec/ai-jobs.md "The fake provider\'s parts"]', () => {
  it('gives a PNG of the input size, colour type 6, see-through at the corner, solid in the centre', async () => {
    const result = await cut()
    expect(result.mime).toBe('image/png')
    const png = decode(result.bytes)
    expect([png.width, png.height, png.colourType]).toEqual([40, 30, 6])
    expect(png.alpha(0, 0)).toBe(0)
    expect(png.alpha(39, 29)).toBe(0)
    expect(png.alpha(20, 15)).toBe(255)
  })
})

describeSwitches('cut-out', cut)
