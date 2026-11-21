// P4-4, D-085: one real extract-brief call to Gemini with the developer's own key, the
// smallest input (a few lines of made-up brief text). Run by hand with `npm run test:live`;
// never part of `npm test` or CI. Paid: one call.
// Prints the model ID, the time taken and the answer's size in bytes (the parsed draft as
// JSON). Never the answer's text, no request, no header and no key.
import { describe, it, expect } from 'vitest'
import { adapters } from '@/main/providers/gemini'
import { listProviders } from '@/main/providers/registry'
import type { AdapterContext } from '@/main/providers/types'
import type { Settings } from '@/shared/schemas/settings'
import { livePrint, missingNames, safely } from './live-output'

const key = process.env.GEMINI_API_KEY
const missingVariables = missingNames(['GEMINI_API_KEY'])
if (missingVariables.length > 0) {
  process.stdout.write(`Gemini brief live test skipped: not set: ${missingVariables.join(', ')}\n`)
}

const BRIEF_TEXT = [
  'Campaign: Spring bikes',
  'Region: Canada',
  'Audience: city commuters',
  'Message: Ride to work in spring',
].join('\n')

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

describe.skipIf(!key)('Gemini extract brief, live [P4-4]', () => {
  it('reads a short brief into a draft', { timeout: 90_000 }, async () => {
    const ctx = liveContext(key ?? '')
    const started = Date.now()
    const draft = await safely('Gemini', async () => {
      const text = adapters.text?.(ctx)
      if (!text) throw new Error('The Gemini text adapter is not built')
      return text.extractBrief({ text: BRIEF_TEXT })
    })
    const ms = Date.now() - started
    expect(typeof draft).toBe('object')
    livePrint([
      `Gemini brief model: ${ctx.model('text')}`,
      `Gemini brief time: ${ms} ms`,
      `Gemini brief answer bytes: ${Buffer.byteLength(JSON.stringify(draft))}`,
      `Gemini brief fields: ${Object.keys(draft).length}`,
    ])
  })
})
