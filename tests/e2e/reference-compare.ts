// spec/testing.md "Reference pictures": the stability rule's tolerance, and where references
// live. Pictures are decoded with Electron's nativeImage in the main process, so no package
// is added; the pixels are compared here.
import { expect, test, type ElectronApplication } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

export const REFERENCE_DIR = path.resolve('tests/reference-pictures', process.platform)
export const UPDATING = process.env.ADMAN_UPDATE_REFERENCES === '1'

// At most 0.5 % of pixels may differ; a pixel differs when any channel is off by more than 8.
const MAX_SHARE = 0.005
const MAX_CHANNEL = 8

export type Bitmap = { width: number; height: number; pixels: Buffer }

// Decodes a PNG to four bytes a pixel, in the main process.
export async function decodePng(app: ElectronApplication, png: Buffer): Promise<Bitmap> {
  const decoded = await app.evaluate(({ nativeImage }, base64) => {
    const image = nativeImage.createFromBuffer(Buffer.from(base64, 'base64'))
    return { ...image.getSize(), base64: image.toBitmap().toString('base64') }
  }, png.toString('base64'))
  const { width, height, base64 } = decoded
  return { width, height, pixels: Buffer.from(base64, 'base64') }
}

// The share of pixels that differ; 1 when the sizes are not the same.
export function differingShare(a: Bitmap, b: Bitmap): number {
  if (a.width !== b.width || a.height !== b.height) return 1
  if (a.pixels.length !== b.pixels.length) return 1
  let differing = 0
  for (let i = 0; i < a.pixels.length; i += 4) {
    for (let c = 0; c < 4; c++) {
      if (Math.abs(a.pixels[i + c]! - b.pixels[i + c]!) > MAX_CHANNEL) {
        differing++
        break
      }
    }
  }
  return differing / (a.pixels.length / 4)
}

// Compares a drawn picture with its reference, or writes it when references are being made.
// A missing reference fails on macOS and skips on Windows until the stakeholder makes them.
export async function checkReference(app: ElectronApplication, name: string, png: Buffer) {
  const file = path.join(REFERENCE_DIR, `${name}.png`)
  if (UPDATING) {
    fs.mkdirSync(REFERENCE_DIR, { recursive: true })
    fs.writeFileSync(file, png)
    return
  }
  if (!fs.existsSync(file)) {
    test.skip(process.platform === 'win32', 'No Windows reference yet.')
    throw new Error(`There is no reference picture ${file}.`)
  }
  const drawn = await decodePng(app, png)
  const stored = await decodePng(app, fs.readFileSync(file))
  const share = differingShare(drawn, stored)
  const message = `${(share * 100).toFixed(2)} % of the pixels of ${name} differ`
  expect(share, message).toBeLessThanOrEqual(MAX_SHARE)
}
