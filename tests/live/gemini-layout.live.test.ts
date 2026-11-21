// P4-4, D-085: one real layout call to Gemini with the developer's own key, the smallest
// input (a 64-pixel picture made in code, two short text items). Run by hand with
// `npm run test:live`; never part of `npm test` or CI. Paid: one call.
// Prints the model ID, the time taken and the answer's size in bytes (the parsed boxes as
// JSON). Never the answer's text, no request, no header and no key.
import { describe, it, expect } from 'vitest'
import { adapters } from '@/main/providers/gemini'
import { listProviders } from '@/main/providers/registry'
import type { AdapterContext } from '@/main/providers/types'
import type { Settings } from '@/shared/schemas/settings'
import { livePrint, missingNames, safely } from './live-output'
import { circlePng } from './shape-picture'

const key = process.env.GEMINI_API_KEY
const missingVariables = missingNames(['GEMINI_API_KEY'])
if (missingVariables.length > 0) {
  process.stdout.write(`Gemini layout live test skipped: not set: ${missingVariables.join(', ')}\n`)
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

describe.skipIf(!key)('Gemini layout, live [P4-4]', () => {
  it('proposes boxes for two text items on a small picture', { timeout: 90_000 }, async () => {
    const ctx = liveContext(key ?? '')
    const started = Date.now()
    const boxes = await safely('Gemini', async () => {
      const layout = adapters.layout?.(ctx)
      if (!layout) throw new Error('The Gemini layout adapter is not built')
      return layout.propose({
        background: { bytes: circlePng(64), mime: 'image/png' },
        width: 64,
        height: 64,
        items: [
          { slot: 'headline', text: 'Hello' },
          { slot: 'call-to-action', text: 'Go' },
        ],
        palette: ['#000000'],
        fonts: ['Inter'],
      })
    })
    const ms = Date.now() - started
    expect(Array.isArray(boxes)).toBe(true)
    livePrint([
      `Gemini layout model: ${ctx.model('layout')}`,
      `Gemini layout time: ${ms} ms`,
      `Gemini layout answer bytes: ${Buffer.byteLength(JSON.stringify(boxes))}`,
      `Gemini layout boxes: ${boxes.length}`,
    ])
  })
})
