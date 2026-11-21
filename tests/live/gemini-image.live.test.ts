// SPEC 6.2, 13, 14 slice E: one real picture from Gemini with the developer's own key.
// Run by hand with `npm run test:live`; never part of `npm test` or CI. Paid: one call.
// Prints the picture's path and nothing else. The key is never printed.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it, expect } from 'vitest'
import { adapters } from '../../src/main/providers/gemini'
import { listProviders } from '../../src/main/providers/registry'
import type { AdapterContext } from '../../src/main/providers/types'
import type { Settings } from '../../src/shared/schemas/settings'

const key = process.env.GEMINI_API_KEY
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

if (!key) process.stdout.write('Gemini live test skipped: GEMINI_API_KEY is not set\n')

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

describe.skipIf(!key)('Gemini picture, live [SPEC 6.2, slice E]', () => {
  it('makes one PNG and writes it to a temporary folder', { timeout: 150_000 }, async () => {
    const image = adapters.image?.(liveContext(key ?? ''))
    if (!image) throw new Error('The Gemini image adapter is not built')
    const results = await image.generate({
      prompt:
        'A red bicycle leaning on a sunny brick wall. ' +
        'Do not include any text, letters, numbers, logos or watermarks in the image.',
      references: [],
      width: 1080,
      height: 1080,
      count: 1,
    })
    expect(results).toHaveLength(1)
    const png = results[0]?.png ?? new Uint8Array()
    expect([...png.slice(0, 8)]).toEqual(PNG_SIGNATURE)
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-gemini-live-'))
    const file = path.join(folder, 'gemini-image.png')
    fs.writeFileSync(file, png)
    process.stdout.write(`Gemini picture (${results[0]?.model}): ${file}\n`)
  })
})
