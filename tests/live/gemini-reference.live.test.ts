// SPEC 6.2, 13, 14 [1.46] part A, OI-79: one real Gemini picture from a prompt plus reference
// pictures, with the developer's own key. Proves the default Gemini picture model takes
// pictures as input on a live call. Run by hand only; never part of `npm test` or CI.
// Paid: one call, no retry. To run this case alone:
//   npm run test:live -- tests/live/gemini-reference.live.test.ts
// The references: by default one picture made here in code (shape-picture.ts), a magenta
// circle on white. With ADMAN_LIVE_REFERENCE_FILES set in the terminal (one to three PNG or
// JPEG paths, separated by commas, relative to the project root or absolute), those files in
// that order, with a product prompt (reference-files.ts). A bad list fails before the call.
// Prints the file path, type, pixel size, byte count and model ID of the result, and the count,
// type and pixel size of the references sent. Never a request, header, key, reference path or
// bytes. Every printed line, and the error thrown on a failure, has the live key values removed.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'
import { adapters } from '../../src/main/providers/gemini'
import { listProviders } from '../../src/main/providers/registry'
import type { AdapterContext, ImageResult } from '../../src/main/providers/types'
import { pictureType } from '../../src/main/providers/picture-type'
import { pictureSize } from '../../src/main/providers/picture-size'
import type { Settings } from '../../src/shared/schemas/settings'
import { livePrint, missingNames, safely } from './live-output'
import { circlePng } from './shape-picture'
import { referenceFiles } from './reference-files'
import type { ReferenceFile } from './reference-files'

const key = process.env.GEMINI_API_KEY
const EXTENSION = { 'image/png': 'png', 'image/jpeg': 'jpg' } as const
const PROJECT_ROOT = fileURLToPath(new URL('../../', import.meta.url))
const NO_TEXT = 'Do not include any text, letters, numbers, logos or watermarks in the image.'
const CIRCLE_PROMPT =
  'Place the shape from the reference picture on a wooden table, photographed from above. ' +
  `Keep its exact colour and shape. ${NO_TEXT}`
const PRODUCT_PROMPT =
  'Make a product photograph of the item from the reference picture standing on a wooden ' +
  "table in soft daylight, seen from the front. Keep the item's exact shape, colours and " +
  `materials. ${NO_TEXT}`

const missingVariables = missingNames(['GEMINI_API_KEY'])
if (missingVariables.length > 0) {
  process.stdout.write(
    `Gemini reference live test skipped: not set: ${missingVariables.join(', ')}\n`,
  )
}

type Plan = { prompt: string; references: ReferenceFile[]; facts: string[] }

// Reads and checks the references before any call. A bad list prints one safe line and fails.
function planTheCall(): Promise<Plan> {
  return safely('Reference files', async () => {
    const files = referenceFiles(process.env.ADMAN_LIVE_REFERENCE_FILES, PROJECT_ROOT)
    const references: ReferenceFile[] = files ?? [{ bytes: circlePng(768), mime: 'image/png' }]
    const sizes = references.map((file, index) => {
      const size = pictureSize(file.bytes, file.mime)
      return `Reference picture ${index + 1}: ${file.mime}, ${size.width} x ${size.height}`
    })
    const facts = [`Reference pictures sent: ${references.length}`, ...sizes]
    return { prompt: files ? PRODUCT_PROMPT : CIRCLE_PROMPT, references, facts }
  })
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
function makeOnePicture(apiKey: string, plan: Plan): Promise<ImageResult[]> {
  return safely('Gemini', async () => {
    const image = adapters.image?.(liveContext(apiKey))
    if (!image) throw new Error('The Gemini image adapter is not built')
    return image.generate({
      prompt: plan.prompt,
      references: plan.references,
      width: 1080,
      height: 1080,
      count: 1,
    })
  })
}

describe.skipIf(!key)('Gemini picture from a reference, live [SPEC 14 1.46, OI-79]', () => {
  it('makes one picture from a prompt and its references', { timeout: 150_000 }, async () => {
    const plan = await planTheCall()
    const results = await makeOnePicture(key ?? '', plan)
    expect(results).toHaveLength(1)
    const bytes = results[0]?.bytes ?? new Uint8Array()
    const mime = results[0]?.mime ?? 'image/png'
    expect(pictureType(bytes)).toBe(mime)
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-gemini-reference-live-'))
    const file = path.join(folder, `gemini-reference.${EXTENSION[mime]}`)
    fs.writeFileSync(file, bytes)
    const size = pictureSize(bytes, mime)
    livePrint([
      ...plan.facts,
      `Gemini reference picture file: ${file}`,
      `Gemini reference picture type: ${mime}`,
      `Gemini reference picture pixel size: ${size.width} x ${size.height}`,
      `Gemini reference picture bytes: ${bytes.byteLength}`,
      `Gemini model: ${results[0]?.model}`,
    ])
  })
})
