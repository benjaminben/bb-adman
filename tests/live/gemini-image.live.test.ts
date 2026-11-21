// SPEC 6.2, 13, 14 slice E: one real picture from Gemini with the developer's own key.
// Run by hand with `npm run test:live`; never part of `npm test` or CI. Paid: one call.
// [1.12] O-8, G6: prints a fixed set of facts the stakeholder can pass on. On success: the
// file path, the pixel size read from the PNG, the size in bytes and the model ID. On failure:
// the error kind and the detail (with the key removed). No request, header or key is printed.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it, expect } from 'vitest'
import { adapters } from '../../src/main/providers/gemini'
import { redactSecret } from '../../src/main/providers/redact'
import { listProviders } from '../../src/main/providers/registry'
import { ProviderFailure, type AdapterContext } from '../../src/main/providers/types'
import type { ImageResult } from '../../src/main/providers/types'
import type { Settings } from '../../src/shared/schemas/settings'
import { pngPixelSize } from './png-size'

const key = process.env.GEMINI_API_KEY
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

if (!key) process.stdout.write('Gemini live test skipped: GEMINI_API_KEY is not set\n')

function print(lines: string[]) {
  process.stdout.write(lines.map((line) => `${line}\n`).join(''))
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

// The one paid call. A ProviderFailure prints its kind and detail, then fails the test.
async function makeOnePicture(apiKey: string): Promise<ImageResult[]> {
  const image = adapters.image?.(liveContext(apiKey))
  if (!image) throw new Error('The Gemini image adapter is not built')
  try {
    return await image.generate({
      prompt:
        'A red bicycle leaning on a sunny brick wall. ' +
        'Do not include any text, letters, numbers, logos or watermarks in the image.',
      references: [],
      width: 1080,
      height: 1080,
      count: 1,
    })
  } catch (error) {
    if (error instanceof ProviderFailure) {
      print([
        `Gemini error kind: ${error.error.kind}`,
        `Gemini error detail: ${redactSecret(error.error.detail, apiKey)}`,
      ])
    }
    throw error
  }
}

describe.skipIf(!key)('Gemini picture, live [SPEC 6.2, slice E]', () => {
  it('makes one PNG and writes it to a temporary folder', { timeout: 150_000 }, async () => {
    const results = await makeOnePicture(key ?? '')
    expect(results).toHaveLength(1)
    const png = results[0]?.png ?? new Uint8Array()
    expect([...png.slice(0, 8)]).toEqual(PNG_SIGNATURE)
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-gemini-live-'))
    const file = path.join(folder, 'gemini-image.png')
    fs.writeFileSync(file, png)
    const size = pngPixelSize(png)
    print([
      `Gemini picture file: ${file}`,
      `Gemini picture pixel size: ${size.width} x ${size.height}`,
      `Gemini picture bytes: ${png.byteLength}`,
      `Gemini model: ${results[0]?.model}`,
    ])
  })
})
