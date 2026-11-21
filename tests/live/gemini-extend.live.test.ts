// spec/providers-adapters.md "Picture extend" (P5-6, A-128): one real Gemini extend run with the
// developer's own key. Proves a square picture comes back extended to a tall shape. Run by hand
// only, once, in P5-19 (D-085); never part of `npm test` or CI. Paid: one call, no retry.
// To run this case alone:
//   npm run test:live -- tests/live/gemini-extend.live.test.ts
// The picture sent is made here in code (shape-picture.ts), a magenta circle on white, so it
// holds no user file, brand or person. Prints the file path, type, pixel size, byte count and
// model ID of the result. Never a request, header, key or bytes. Every printed line, and the
// error thrown on a failure, has the live key values removed.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it, expect } from 'vitest'
import { adapters } from '@/main/providers/gemini'
import { listProviders } from '@/main/providers/registry'
import type { AdapterContext, ImageResult } from '@/main/providers/types'
import { pictureType } from '@/main/providers/picture-type'
import { pictureSize } from '@/main/providers/picture-size'
import type { Settings } from '@/shared/schemas/settings'
import { promptToSend } from '@/shared/generation/prompt'
import { livePrint, missingNames, safely } from './live-output'
import { circlePng } from './shape-picture'

const key = process.env.GEMINI_API_KEY
const EXTENSION = { 'image/png': 'png', 'image/jpeg': 'jpg' } as const
const SOURCE_SIDE = 512
const TARGET = { width: 1080, height: 1920 }
// The ending is added by promptToSend, as the app adds it, with one picture sent.
const PROMPT = promptToSend(
  'Extend this picture outward to fill the new shape. Keep the original picture unchanged ' +
    'in the centre and continue its background naturally beyond its edges.',
  { pictures: 1 },
)

const missingVariables = missingNames(['GEMINI_API_KEY'])
if (missingVariables.length > 0) {
  process.stdout.write(`Gemini extend live test skipped: not set: ${missingVariables.join(', ')}\n`)
}

function liveContext(apiKey: string): AdapterContext {
  const gemini = listProviders({}).find((p) => p.id === 'gemini')
  return {
    secret: () => apiKey,
    settings: () => ({}) as Settings,
    model(job) {
      const model = gemini?.defaultModels[job]
      if (!model) throw new Error(`No default model for gemini ${job}`)
      return model
    },
  }
}

// The one paid call. A failure prints its kind and detail, made safe, then fails the test.
function extendOnce(apiKey: string): Promise<ImageResult> {
  return safely('Gemini', async () => {
    const image = adapters.image?.(liveContext(apiKey))
    if (!image) throw new Error('The Gemini image adapter is not built')
    const top = (TARGET.height - TARGET.width) / 2
    return image.extend({
      image: { bytes: circlePng(SOURCE_SIDE), mime: 'image/png' },
      placement: {
        x: 0,
        y: top,
        width: TARGET.width,
        height: TARGET.width,
        rotation: 0,
        crop: null,
      },
      width: TARGET.width,
      height: TARGET.height,
      prompt: PROMPT,
    })
  })
}

describe.skipIf(!key)('Gemini picture extend, live [P5-6, run in P5-19]', () => {
  it('extends one square picture to a tall shape', { timeout: 150_000 }, async () => {
    const result = await extendOnce(key ?? '')
    expect(pictureType(result.bytes)).toBe(result.mime)
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-gemini-extend-live-'))
    const file = path.join(folder, `gemini-extend.${EXTENSION[result.mime]}`)
    fs.writeFileSync(file, result.bytes)
    const size = pictureSize(result.bytes, result.mime)
    livePrint([
      `Picture sent: image/png, ${SOURCE_SIDE} x ${SOURCE_SIDE}`,
      `Target shape: ${TARGET.width} x ${TARGET.height}`,
      `Gemini extend picture file: ${file}`,
      `Gemini extend picture type: ${result.mime}`,
      `Gemini extend picture pixel size: ${size.width} x ${size.height}`,
      `Gemini extend picture bytes: ${result.bytes.byteLength}`,
      `Gemini model: ${result.model}`,
    ])
  })
})
