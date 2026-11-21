// SPEC 6.2, 13, 14 [1.46] part A, OI-79: one real Gemini picture from a prompt plus one
// reference picture, with the developer's own key. Proves the default Gemini picture model
// takes a picture as input on a live call. Run by hand only; never part of `npm test` or CI.
// Paid: one call, no retry. To run this case alone:
//   npm run test:live -- tests/live/gemini-reference.live.test.ts
// The reference picture is made here in code (shape-picture.ts): a magenta circle on white.
// Prints the same fixed facts as gemini-image.live.test.ts: the file path, the file type, the
// pixel size, the size in bytes and the model ID. No request, header, key or reference bytes.
// Every printed line, and the error thrown on a failure, has the live key values removed.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it, expect } from 'vitest'
import { adapters } from '../../src/main/providers/gemini'
import { listProviders } from '../../src/main/providers/registry'
import type { AdapterContext } from '../../src/main/providers/types'
import type { ImageResult } from '../../src/main/providers/types'
import { pictureType } from '../../src/main/providers/picture-type'
import { pictureSize } from '../../src/main/providers/picture-size'
import type { Settings } from '../../src/shared/schemas/settings'
import { livePrint, missingNames, safely } from './live-output'
import { circlePng } from './shape-picture'

const key = process.env.GEMINI_API_KEY
const EXTENSION = { 'image/png': 'png', 'image/jpeg': 'jpg' } as const

const missingVariables = missingNames(['GEMINI_API_KEY'])
if (missingVariables.length > 0) {
  process.stdout.write(
    `Gemini reference live test skipped: not set: ${missingVariables.join(', ')}\n`,
  )
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
function makeOnePicture(apiKey: string): Promise<ImageResult[]> {
  return safely('Gemini', async () => {
    const image = adapters.image?.(liveContext(apiKey))
    if (!image) throw new Error('The Gemini image adapter is not built')
    return image.generate({
      prompt:
        'Place the shape from the reference picture on a wooden table, photographed from ' +
        'above. Keep its exact colour and shape. ' +
        'Do not include any text, letters, numbers, logos or watermarks in the image.',
      references: [{ bytes: circlePng(768), mime: 'image/png' }],
      width: 1080,
      height: 1080,
      count: 1,
    })
  })
}

describe.skipIf(!key)('Gemini picture from a reference, live [SPEC 14 1.46, OI-79]', () => {
  it('makes one picture from a prompt and one reference', { timeout: 150_000 }, async () => {
    const results = await makeOnePicture(key ?? '')
    expect(results).toHaveLength(1)
    const bytes = results[0]?.bytes ?? new Uint8Array()
    const mime = results[0]?.mime ?? 'image/png'
    expect(pictureType(bytes)).toBe(mime)
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-gemini-reference-live-'))
    const file = path.join(folder, `gemini-reference.${EXTENSION[mime]}`)
    fs.writeFileSync(file, bytes)
    const size = pictureSize(bytes, mime)
    livePrint([
      `Gemini reference picture file: ${file}`,
      `Gemini reference picture type: ${mime}`,
      `Gemini reference picture pixel size: ${size.width} x ${size.height}`,
      `Gemini reference picture bytes: ${bytes.byteLength}`,
      `Gemini model: ${results[0]?.model}`,
    ])
  })
})
