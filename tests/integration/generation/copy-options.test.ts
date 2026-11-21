// P4-8: generation.copyOptions and the copy_options job (spec/ai-jobs.md "Copy options";
// FR-043, FR-045), through the real bus and runner with a stand-in text adapter.
import { describe, it, expect, afterEach } from 'vitest'
import {
  ended,
  waitFor,
  BACKGROUND_LAYER,
  OTHER_LAYER,
  TEXT_LAYER,
  VARIANT,
} from './generation-fixture'
import { VALID_BRIEF } from '../row-fixtures'
import {
  makeTextFixture,
  BODY_LAYER,
  CTA_LAYER,
  KEYED,
  NOT_AVAILABLE,
  PICTURES_ONLY,
  TEXT,
  type TextFixture,
} from './text-fixture'
import { JOBS_AT_ONCE_PER_PROVIDER } from '@/shared/config/job-kinds'

let f: TextFixture
afterEach(() => f.cleanup())

const NO_COPY = { code: 'INVALID_INPUT', message: 'That provider cannot write copy.' }
const NO_LAYER = { code: 'NOT_FOUND', message: 'That layer was not found in this variant.' }
const NOT_TEXT = { code: 'INVALID_INPUT', message: 'Copy options are for text layers.' }
const HEADLINE = {
  code: 'INVALID_INPUT',
  message: 'The headline is the campaign message. Change the message instead.',
}
const NEEDS_KEY = { code: 'NEEDS_KEY', message: 'Add your Keyed key to suggest copy.' }

function ask(input: Record<string, unknown> = {}) {
  return f.user('generation.copyOptions', {
    variantId: VARIANT,
    layerId: CTA_LAYER,
    count: 3,
    provider: TEXT.id,
    ...input,
  })
}

async function start(input: Record<string, unknown> = {}): Promise<string> {
  const r = await ask(input)
  if (!r.ok) throw new Error(`copyOptions failed: ${JSON.stringify(r.error)}`)
  return (r.data as { jobId: string }).jobId
}

async function finished(input: Record<string, unknown> = {}) {
  const id = await start(input)
  await waitFor(ended(f, id))
  return f.job(id)
}

describe('generation.copyOptions refusals [FR-045, FR-043]', () => {
  it.each([
    ['an unknown provider', { provider: 'nope' }, NO_COPY],
    ['a provider without text', { provider: PICTURES_ONLY.id }, NO_COPY],
    ['a provider not available', { provider: NOT_AVAILABLE.id }, NO_COPY],
    ['the provider before the layer', { provider: 'nope', layerId: 'gone' }, NO_COPY],
    ['a missing layer', { layerId: 'gone' }, NO_LAYER],
    ['a layer of another variant', { layerId: OTHER_LAYER }, NO_LAYER],
    ['a picture layer', { layerId: BACKGROUND_LAYER }, NOT_TEXT],
    ['the headline', { layerId: TEXT_LAYER }, HEADLINE],
    ['the headline before the key', { layerId: TEXT_LAYER, provider: KEYED.id }, HEADLINE],
    ['a missing key', { provider: KEYED.id }, NEEDS_KEY],
  ])('refuses %s, with no job row and no call', async (_case, input, error) => {
    f = makeTextFixture()
    const r = await ask(input)
    expect(r).toEqual({ ok: false, error: expect.objectContaining(error) })
    expect(f.jobs()).toEqual([])
    expect(f.t.copyCalls).toEqual([])
  })
})

describe('generation.copyOptions request [FR-045]', () => {
  it.each([
    ['the call-to-action slot', CTA_LAYER, 'call_to_action', 40],
    ['any other text slot', BODY_LAYER, 'text', 120],
  ])('takes role and maxChars from %s', async (_case, layerId, role, maxChars) => {
    f = makeTextFixture()
    const r = await ask({ layerId, count: 5 })
    const { jobId } = r.ok ? (r.data as { jobId: string }) : { jobId: '' }
    expect(r).toEqual({ ok: true, data: { jobId } })
    const job = f.job(jobId)
    expect(job).toMatchObject({
      kind: 'copy_options',
      campaignId: 'c1',
      variantId: VARIANT,
      layerId,
      slot: null,
      provider: TEXT.id,
      model: 'text-model-1',
      startedBy: 'user',
      request: { role, language: 'en', count: 5, maxChars },
    })
    await waitFor(ended(f, jobId))
    expect(f.t.copyCalls).toEqual([
      { role, brief: VALID_BRIEF, language: 'en', count: 5, maxChars },
    ])
  })
})

describe('the copy_options job [FR-045]', () => {
  it('trims, drops empty, too long and repeated options, and cuts to count', async () => {
    f = makeTextFixture()
    const forty = 'a'.repeat(39) + '\u{1F600}' // 40 code points, 41 UTF-16 units
    f.t.copy = ['  Shop now  ', '', '   ', 'x'.repeat(41), 'SHOP NOW', forty, 'Find your fit', 'Go']
    const job = await finished({ count: 3 })
    expect(job).toMatchObject({
      status: 'succeeded',
      paidCalls: 1,
      result: { options: ['Shop now', forty, 'Find your fit'] },
    })
  })

  it('keeps fewer than count when fewer are usable', async () => {
    f = makeTextFixture()
    f.t.copy = ['One', 'one ', 'Two']
    const job = await finished({ count: 5 })
    expect(job?.result).toEqual({ options: ['One', 'Two'] })
  })

  it('fails as other when no option is left', async () => {
    f = makeTextFixture()
    f.t.copy = ['', '  ', 'y'.repeat(41)]
    const job = await finished()
    expect(job).toMatchObject({ status: 'failed', errorKind: 'other', paidCalls: 1 })
    expect(f.errorDetail(job?.id ?? '')).toBe('No usable copy in the answer')
  })

  it('fails as target_gone when the campaign was deleted before the job ran', async () => {
    f = makeTextFixture()
    let release = () => {}
    const gate = new Promise<void>((r) => (release = r))
    f.t.copy = async () => {
      await gate
      return ['Shop now']
    }
    const busy = []
    for (let i = 0; i < JOBS_AT_ONCE_PER_PROVIDER; i += 1) busy.push(await start())
    const last = await start()
    expect(f.job(last)?.status).toBe('queued')
    f.db.prepare("DELETE FROM campaign WHERE id = 'c1'").run()
    release()
    await waitFor(() => [...busy, last].every((id) => ended(f, id)()))
    expect(f.job(last)).toMatchObject({
      status: 'failed',
      errorKind: 'other',
      errorReason: 'target_gone',
      paidCalls: 0,
    })
    expect(f.errorDetail(last)).toBe('target_gone')
    expect(f.t.copyCalls).toHaveLength(JOBS_AT_ONCE_PER_PROVIDER)
  })
})
