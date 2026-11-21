// P4-7: generation.proposeLayout through the real core (spec/ai-jobs.md "Layout proposal").
// No key is saved, so Gemini always meets the key guard; the fake provider needs none.
import { describe, it, expect, afterEach } from 'vitest'
import {
  makeGenerationFixture,
  VARIANT,
  OTHER_VARIANT,
  TEXT_LAYER,
  type GenerationFixture,
} from './generation-fixture'

let f: GenerationFixture
afterEach(() => f.cleanup())

const propose = (input: Record<string, unknown>) =>
  f.user('generation.proposeLayout', { variantId: VARIANT, provider: 'fake', ...input })

const setText = (sql: string, ...values: unknown[]) =>
  f.db.prepare(`UPDATE layer SET ${sql} WHERE id = ?`).run(...values, TEXT_LAYER)

const CANNOT = 'That provider cannot place text.'
const NO_VARIANT = 'That variant was not found.'
const NO_TEXT = 'Add text to a text layer first.'

describe('generation.proposeLayout refusals, in order [spec/ai-jobs.md]', () => {
  it.each<[string, Record<string, unknown>, () => void, string, string]>([
    [
      'an unknown provider',
      { provider: 'nope', variantId: 'gone' },
      () => {},
      'INVALID_INPUT',
      CANNOT,
    ],
    [
      'a provider that does no layout',
      { provider: 'comfyui', variantId: 'gone' },
      () => {},
      'INVALID_INPUT',
      CANNOT,
    ],
    [
      'a provider not available',
      { provider: 'firefly', variantId: 'gone' },
      () => {},
      'INVALID_INPUT',
      CANNOT,
    ],
    [
      'an unknown variant, before the key',
      { provider: 'gemini', variantId: 'gone' },
      () => {},
      'NOT_FOUND',
      NO_VARIANT,
    ],
    [
      'a variant with no text layer, before the key',
      { provider: 'gemini', variantId: OTHER_VARIANT },
      () => {},
      'INVALID_INPUT',
      NO_TEXT,
    ],
    [
      'a hidden text layer',
      { provider: 'gemini' },
      () => setText('visible = 0'),
      'INVALID_INPUT',
      NO_TEXT,
    ],
    [
      'a blank text layer',
      { provider: 'gemini' },
      () => setText("copy = '  \n '"),
      'INVALID_INPUT',
      NO_TEXT,
    ],
  ])('refuses %s, with no job row', async (_, input, change, code, message) => {
    f = await makeGenerationFixture()
    change()
    const r = await propose(input)
    expect(r).toMatchObject({ ok: false, error: { code, message } })
    expect(f.jobs()).toEqual([])
  })

  it('names the provider it refused', async () => {
    f = await makeGenerationFixture()
    const r = await propose({ provider: 'comfyui' })
    expect(r).toMatchObject({ ok: false, error: { details: { provider: 'comfyui' } } })
  })

  it('calls the key guard last, for "place text with AI"', async () => {
    f = await makeGenerationFixture()
    const r = await propose({ provider: 'gemini' })
    expect(r).toMatchObject({
      ok: false,
      error: {
        code: 'NEEDS_KEY',
        message: 'Add your Google Gemini key to place text with AI.',
      },
    })
    expect(f.jobs()).toEqual([])
  })
})

describe('generation.proposeLayout enqueues [spec/ai-jobs.md]', () => {
  it('one attached layout_proposal job with the campaign and variant, no layer, no slot', async () => {
    f = await makeGenerationFixture()
    const r = await propose({})
    expect(r.ok).toBe(true)
    const { jobId } = (r as { data: { jobId: string } }).data
    expect(f.job(jobId)).toMatchObject({
      kind: 'layout_proposal',
      campaignId: 'c1',
      variantId: VARIANT,
      layerId: null,
      slot: null,
      provider: 'fake',
      request: {},
      startedBy: 'user',
    })
    expect(f.jobs()).toHaveLength(1)
  })
})
