// P4-4, D-085: one real copy-options call to Gemini with the developer's own key, the
// smallest input (count 2, a made-up brief). Run by hand with `npm run test:live`; never part
// of `npm test` or CI. Paid: one call.
// Prints the model ID, the time taken and the answer's size in bytes (the parsed options as
// JSON). Never the answer's text, no request, no header and no key.
import { describe, it, expect } from 'vitest'
import { adapters } from '@/main/providers/gemini'
import { listProviders } from '@/main/providers/registry'
import type { AdapterContext } from '@/main/providers/types'
import type { Brief } from '@/shared/schemas/brief'
import type { Settings } from '@/shared/schemas/settings'
import { livePrint, missingNames, safely } from './live-output'

const key = process.env.GEMINI_API_KEY
const missingVariables = missingNames(['GEMINI_API_KEY'])
if (missingVariables.length > 0) {
  process.stdout.write(`Gemini copy live test skipped: not set: ${missingVariables.join(', ')}\n`)
}

const BRIEF: Brief = {
  campaignName: 'Spring bikes',
  region: 'Canada',
  audience: 'city commuters',
  message: 'Ride to work in spring',
  subjects: [{ name: 'Bike' }],
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

describe.skipIf(!key)('Gemini copy options, live [P4-4]', () => {
  it('writes two call-to-action options', { timeout: 90_000 }, async () => {
    const ctx = liveContext(key ?? '')
    const started = Date.now()
    const options = await safely('Gemini', async () => {
      const text = adapters.text?.(ctx)
      if (!text) throw new Error('The Gemini text adapter is not built')
      return text.copyOptions({
        role: 'call_to_action',
        brief: BRIEF,
        language: 'en',
        count: 2,
        maxChars: 30,
      })
    })
    const ms = Date.now() - started
    expect(Array.isArray(options)).toBe(true)
    livePrint([
      `Gemini copy model: ${ctx.model('text')}`,
      `Gemini copy time: ${ms} ms`,
      `Gemini copy answer bytes: ${Buffer.byteLength(JSON.stringify(options))}`,
      `Gemini copy options: ${options.length}`,
    ])
  })
})
