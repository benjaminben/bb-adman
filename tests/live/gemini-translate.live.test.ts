// P6-17, D-085 (spec/phases/phase-06.md section 3): one real translate call to Gemini with the
// developer's own key, the smallest input (two short made-up items, en to de). Run by hand
// once; never part of `npm test` or CI. Paid: one call, no retry.
// To run this case alone:
//   npm run test:live -- tests/live/gemini-translate.live.test.ts
// Prints the model ID, the time taken and the answer's size in bytes. Never the answer's text,
// no request, no header, no address and no key. Every printed line, and the error thrown on a
// failure, has the live key values removed.
import { describe, it, expect } from 'vitest'
import { adapters } from '@/main/providers/gemini'
import { listProviders } from '@/main/providers/registry'
import type { AdapterContext } from '@/main/providers/types'
import type { Settings } from '@/shared/schemas/settings'
import { livePrint, missingNames, safely } from './live-output'

const key = process.env.GEMINI_API_KEY
const missingVariables = missingNames(['GEMINI_API_KEY'])
if (missingVariables.length > 0) {
  process.stdout.write(
    `Gemini translate live test skipped: not set: ${missingVariables.join(', ')}\n`,
  )
}

const ITEMS = [
  { key: 'headline', text: 'Fresh bread every morning' },
  { key: 'cta', text: 'Visit us today' },
]

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

describe.skipIf(!key)('Gemini translate, live [P6-17]', () => {
  it('translates two short texts from en to de', { timeout: 90_000 }, async () => {
    const ctx = liveContext(key ?? '')
    const started = Date.now()
    const answer = await safely('Gemini', async () => {
      const text = adapters.text?.(ctx)
      if (!text) throw new Error('The Gemini text adapter is not built')
      return text.translate({
        items: ITEMS,
        from: 'en',
        to: 'de',
        region: 'Germany',
        audience: 'neighbourhood shoppers',
      })
    })
    const ms = Date.now() - started
    livePrint([
      `Gemini translate model: ${ctx.model('text')}`,
      `Gemini translate time: ${ms} ms`,
      `Gemini translate answer bytes: ${Buffer.byteLength(JSON.stringify(answer))}`,
      `Gemini translate items: ${answer.length}`,
    ])
    expect(answer.map((item) => item.key).sort()).toEqual(['cta', 'headline'])
    for (const item of answer) expect(item.text.trim()).not.toBe('')
  })
})
