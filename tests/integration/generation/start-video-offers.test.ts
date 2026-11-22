// P7-11 (phase-07.md "fal.ai Seedance" and "The format switch and the start"; security class):
// generation.startVideo applies the offer table, the format refusal and background_empty
// for every provider, before any provider call and before any job row. The fal row is a
// stand-in made available in this file only; fetch is stubbed, so nothing leaves the machine.
import { describe, it, expect, afterEach, vi } from 'vitest'
import {
  makeGenerationFixture,
  waitFor,
  ended,
  BACKGROUND_LAYER,
  VARIANT,
  type GenerationFixture,
} from './generation-fixture'
import { data } from '../core-fixture'
import { greyPng } from '@/main/providers/fake/png'
import type { ProviderInfo } from '@/shared/schemas/queries/app'

let f: GenerationFixture
let fetchSpy: ReturnType<typeof vi.spyOn> | null = null
afterEach(() => {
  f.cleanup()
  fetchSpy?.mockRestore()
  fetchSpy = null
})

const ask = {
  variantId: VARIANT,
  prompt: 'Waves on a rock',
  durationMs: 4_000,
  provider: 'fake',
  start: 'none',
  useReferences: false,
  referenceAssetIds: [] as string[],
}

// The fixture's master variant, changed to video unless the case is about an image post.
async function ready(format: 'image' | 'video' = 'video') {
  f = await makeGenerationFixture()
  f.db.prepare('UPDATE variant SET format = ? WHERE id = ?').run(format, VARIANT)
  fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('no network in tests'))
  const providers = f.core.deps.providers as ProviderInfo[]
  const at = providers.findIndex((p) => p.id === 'fal-seedance')
  providers.splice(at, 1, { ...(providers[at] as ProviderInfo), available: true })
  f.core.deps.secrets.set('fal.apiKey', 'test-key-not-real')
}

const start = (input: Record<string, unknown>, actor: 'user' | 'agent' = 'user') =>
  f.core.bus.execute(
    'generation.startVideo',
    { projectId: f.projectId, ...ask, ...input },
    { actor },
  )

async function refused(input: Record<string, unknown>, error: Record<string, unknown>) {
  expect(await start(input)).toMatchObject({ ok: false, error })
  expect(f.jobs()).toEqual([])
  expect(fetchSpy).not.toHaveBeenCalled()
}

const pictures = async (n: number) => {
  const ids: string[] = []
  for (let i = 0; i < n; i++) ids.push(await f.importPicture(`pic-${i}.png`, greyPng(5 + i, 5)))
  return ids
}

const FAKE_LENGTH = 'Fake provider makes clips of 1 to 120 seconds.'
const FAL_LENGTH = 'fal.ai Seedance makes clips of 4 to 15 seconds.'

describe('generation.startVideo offers [P7-11, A-175] (security class)', () => {
  it.each([
    ['a prompt start of 1 s', { durationMs: 1_000 }, 0],
    ['a prompt start of 120 s', { durationMs: 120_000 }, 0],
    ['a first-frame start', { start: 'first_frame' }, 1],
    ['four references', { useReferences: true }, 4],
  ])(
    'the fake provider takes %s',
    async (_, input, n) => {
      await ready()
      const referenceAssetIds = await pictures(n)
      const { jobId } = data<{ jobId: string }>(await start({ ...input, referenceAssetIds }))
      expect(f.job(jobId)?.request).toMatchObject({ referenceAssetIds })
      await waitFor(ended(f, jobId), 10_000)
    },
    15_000,
  )

  it.each([
    ['fake', 999, FAKE_LENGTH],
    ['fake', 120_001, FAKE_LENGTH],
    ['fake', 1_500, FAKE_LENGTH],
    ['fal-seedance', 3_999, FAL_LENGTH],
    ['fal-seedance', 15_001, FAL_LENGTH],
    ['fal-seedance', 4_500, FAL_LENGTH],
  ])('%s refuses %d ms: video_length_not_offered', async (provider, durationMs, message) => {
    await ready()
    await refused(
      { provider, durationMs },
      { code: 'RULE_VIOLATION', message, details: { reason: 'video_length_not_offered' } },
    )
  })

  it('fake refuses 5 references before any is read: too_many_references', async () => {
    await ready()
    const referenceAssetIds = Array.from({ length: 5 }, (_, i) => `not-there-${i}`)
    await refused(
      { useReferences: true, referenceAssetIds },
      {
        code: 'RULE_VIOLATION',
        message: 'Fake provider takes at most 4 reference pictures for a video.',
        details: { reason: 'too_many_references', max: 4 },
      },
    )
  })

  // fal's offer of 9 is past the run cap of 8 (MAX_REFERENCES_PER_RUN), which the input
  // schema applies first; the offer's own count is covered in video-offer-checks.test.ts.
  it('fal-seedance refuses 9 references at the run cap before any is read', async () => {
    await ready()
    const referenceAssetIds = Array.from({ length: 9 }, (_, i) => `not-there-${i}`)
    const input = { provider: 'fal-seedance', useReferences: true, referenceAssetIds }
    await refused(input, { code: 'INVALID_INPUT' })
  })

  it.each([['fake'], ['fal-seedance']])(
    '%s refuses a first frame with references: video_start_not_offered',
    async (provider) => {
      await ready()
      const [id] = await pictures(1)
      const input = { provider, start: 'first_frame', useReferences: true, referenceAssetIds: [id] }
      await refused(input, {
        code: 'RULE_VIOLATION',
        details: { reason: 'video_start_not_offered' },
      })
    },
  )

  it.each([['fake'], ['fal-seedance'], ['comfyui']])(
    '%s refuses an image post: video_needs_video_post',
    async (provider) => {
      await ready('image')
      await refused(
        { provider, durationMs: 4_000 },
        {
          code: 'RULE_VIOLATION',
          message: 'Change this post to video before making a clip for it.',
          details: { reason: 'video_needs_video_post' },
        },
      )
    },
  )

  it.each([['fake'], ['fal-seedance'], ['comfyui']])(
    '%s refuses a background start with no background picture: background_empty',
    async (provider) => {
      await ready()
      await refused(
        { provider, start: 'background' },
        {
          code: 'RULE_VIOLATION',
          message: 'This post has no background picture yet. Add one, or start from a prompt.',
          details: { reason: 'background_empty' },
        },
      )
    },
  )

  it('refuses a background start with a picture: video_not_built until P7-16', async () => {
    await ready()
    const [id] = await pictures(1)
    const source = JSON.stringify({ assetId: id })
    f.db.prepare('UPDATE layer SET source = ? WHERE id = ?').run(source, BACKGROUND_LAYER)
    await refused({ start: 'background' }, { details: { reason: 'video_not_built' } })
  })

  it('refuses a background start that names a picture too', async () => {
    await ready()
    const [id] = await pictures(1)
    await refused({ start: 'background', referenceAssetIds: [id] }, { code: 'INVALID_INPUT' })
  })

  it('refuses an agent outside the offer, with the provider ticked [AR-1]', async () => {
    await ready()
    await f.core.bus.execute(
      'agentRuns.setAllowed',
      { provider: 'fake', allowed: true },
      { actor: 'user' },
    )
    expect(await start({ durationMs: 200_000 }, 'agent')).toMatchObject({
      ok: false,
      error: { details: { reason: 'video_length_not_offered' } },
    })
    expect(f.jobs()).toEqual([])
  })
})
