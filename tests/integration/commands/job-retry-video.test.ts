// P7-11 (phase-07.md "The format switch and the start"; security class): job.retry of a video
// row of any provider runs the start pair, picture, offer and format checks, before any job
// row and before any provider call. The rows are crafted, as a changed project file could be.
import { describe, it, expect, afterEach, vi } from 'vitest'
import {
  makeGenerationFixture,
  waitFor,
  ended,
  VARIANT,
  type GenerationFixture,
} from '../generation/generation-fixture'
import { insertTestAsset } from '../assets/asset-rows'
import { data } from '../core-fixture'
import type { ProviderInfo } from '@/shared/schemas/queries/app'

let f: GenerationFixture
let fetchSpy: ReturnType<typeof vi.spyOn> | null = null
afterEach(() => {
  f.cleanup()
  fetchSpy?.mockRestore()
  fetchSpy = null
})

const request = {
  prompt: 'Waves on a rock',
  durationMs: 4_000,
  width: 1080,
  height: 1350,
  start: 'none',
  referenceAssetIds: [] as string[],
}

async function ready(format: 'image' | 'video' = 'video') {
  f = await makeGenerationFixture()
  f.db.prepare('UPDATE variant SET format = ? WHERE id = ?').run(format, VARIANT)
  fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('no network in tests'))
  const providers = f.core.deps.providers as ProviderInfo[]
  const at = providers.findIndex((p) => p.id === 'fal-seedance')
  providers.splice(at, 1, { ...(providers[at] as ProviderInfo), available: true })
  f.core.deps.secrets.set('fal.apiKey', 'test-key-not-real')
}

function failedVideo(provider: string, change: Record<string, unknown> = {}): void {
  f.db
    .prepare(
      `INSERT INTO job (id, kind, status, provider, model, request, campaign_id, variant_id,
         created_at, updated_at)
       VALUES ('j-old', 'video_generation', 'failed', ?, '', ?, 'c1', ?,
         '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`,
    )
    .run(provider, JSON.stringify({ ...request, ...change }), VARIANT)
}

async function refused(error: Record<string, unknown>) {
  const r = await f.user('job.retry', { jobId: 'j-old' })
  expect(r).toMatchObject({ ok: false, error })
  expect(f.jobs().map((j) => j.id)).toEqual(['j-old'])
  expect(fetchSpy).not.toHaveBeenCalled()
  return r
}

const PROVIDERS = [['fake'], ['fal-seedance']]

describe('job.retry of a video row of any provider [P7-11, A-176] (security class)', () => {
  it.each(PROVIDERS)('%s: a first frame naming a font is refused picture_not_usable', async (p) => {
    await ready()
    const absPath = `${f.root}/brand.ttf`
    insertTestAsset(f.db, {
      id: 'font-1',
      kind: 'font',
      mime: 'font/ttf',
      relPath: 'brand.ttf',
      absPath,
    })
    failedVideo(p, { start: 'first_frame', referenceAssetIds: ['font-1'] })
    const r = await refused({
      code: 'RULE_VIOLATION',
      message: 'This picture cannot be used for a video yet. Use a PNG, JPEG or WebP.',
      details: { reason: 'picture_not_usable' },
    })
    expect(JSON.stringify(r)).not.toContain(f.root)
  })

  it.each([...PROVIDERS, ['comfyui']])('%s: a row whose variant is now an image', async (p) => {
    await ready('image')
    failedVideo(p)
    await refused({
      code: 'RULE_VIOLATION',
      message: 'Change this post to video before making a clip for it.',
      details: { reason: 'video_needs_video_post' },
    })
  })

  it.each(PROVIDERS)('%s: a length outside the offer', async (p) => {
    await ready()
    failedVideo(p, { durationMs: 200_000 })
    await refused({ code: 'RULE_VIOLATION', details: { reason: 'video_length_not_offered' } })
  })

  it('fake: more references than the offer takes, before any is read', async () => {
    await ready()
    const referenceAssetIds = Array.from({ length: 5 }, (_, i) => `not-there-${i}`)
    failedVideo('fake', { referenceAssetIds })
    await refused({ code: 'RULE_VIOLATION', details: { reason: 'too_many_references', max: 4 } })
  })

  it.each(PROVIDERS)('%s: a first frame naming two pictures', async (p) => {
    await ready()
    failedVideo(p, { start: 'first_frame', referenceAssetIds: ['a1', 'a2'] })
    await refused({ code: 'INVALID_INPUT', message: 'Choose one picture for this video.' })
  })

  it.each(PROVIDERS)('%s: a background start with no background picture', async (p) => {
    await ready()
    failedVideo(p, { start: 'background' })
    await refused({ code: 'RULE_VIOLATION', details: { reason: 'background_empty' } })
  })

  it.each(PROVIDERS)('%s: a request that does not parse: video_start_not_offered', async (p) => {
    await ready()
    failedVideo(p, { start: 'last_frame' })
    await refused({ code: 'RULE_VIOLATION', details: { reason: 'video_start_not_offered' } })
  })

  it('a row whose provider makes no videos is refused with no ID echoed', async () => {
    await ready()
    failedVideo('gemini')
    const r = await refused({ code: 'INVALID_INPUT', message: 'That provider cannot make videos.' })
    expect(JSON.stringify(r)).not.toContain('gemini')
  })

  it('fake: a good row on a video post is tried again', async () => {
    await ready()
    failedVideo('fake')
    const { jobId } = data<{ jobId: string }>(await f.user('job.retry', { jobId: 'j-old' }))
    expect(f.job(jobId)).toMatchObject({ provider: 'fake', kind: 'video_generation' })
    await waitFor(ended(f, jobId), 10_000)
  }, 15_000)
})
