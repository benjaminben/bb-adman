// SPEC 6.2, 13, 14 slice E: one real picture from Gemini with the developer's own key.
// Run by hand with `npm run test:live`; never part of `npm test` or CI. Paid: one call.
// [1.12] O-8, G6: prints a fixed set of facts the stakeholder can pass on. On success: the
// file path, the file type, the pixel size, the size in bytes and the model ID. On failure:
// the error kind and the detail (with the key removed). No request, header or key is printed.
// [1.14] H11, [1.15] H16: every printed line, and the error thrown on a failure, has the
// LIVE_REDACTED_NAMES values removed (live-output.ts); the real error is not let out, so
// Vitest cannot print it.
// [1.18] K4: the picture is a PNG or a JPEG. The file gets the extension of its real type, and
// the file type is printed with the other facts; the pixel size is read from either.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it, expect } from 'vitest'
import { adapters } from '../../src/main/providers/gemini'
import { listProviders } from '../../src/main/providers/registry'
import type { AdapterContext } from '../../src/main/providers/types'
import type { ImageResult } from '../../src/main/providers/types'
import { pictureType } from '../../src/main/providers/picture-type'
import type { Settings } from '../../src/shared/schemas/settings'
import { livePrint, missingNames, safely } from './live-output'
import { pictureSize } from '../../src/main/providers/picture-size'

const key = process.env.GEMINI_API_KEY
const EXTENSION = { 'image/png': 'png', 'image/jpeg': 'jpg' } as const

const missingVariables = missingNames(['GEMINI_API_KEY'])
if (missingVariables.length > 0) {
  process.stdout.write(`Gemini live test skipped: not set: ${missingVariables.join(', ')}\n`)
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
        'A red bicycle leaning on a sunny brick wall. ' +
        'Do not include any text, letters, numbers, logos or watermarks in the image.',
      references: [],
      width: 1080,
      height: 1080,
      count: 1,
    })
  })
}

describe.skipIf(!key)('Gemini picture, live [SPEC 6.2, slice E]', () => {
  it('makes one picture and writes it to a temporary folder', { timeout: 150_000 }, async () => {
    const results = await makeOnePicture(key ?? '')
    expect(results).toHaveLength(1)
    const bytes = results[0]?.bytes ?? new Uint8Array()
    const mime = results[0]?.mime ?? 'image/png'
    expect(pictureType(bytes)).toBe(mime)
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-gemini-live-'))
    const file = path.join(folder, `gemini-image.${EXTENSION[mime]}`)
    fs.writeFileSync(file, bytes)
    const size = pictureSize(bytes, mime)
    livePrint([
      `Gemini picture file: ${file}`,
      `Gemini picture type: ${mime}`,
      `Gemini picture pixel size: ${size.width} x ${size.height}`,
      `Gemini picture bytes: ${bytes.byteLength}`,
      `Gemini model: ${results[0]?.model}`,
    ])
  })
})
