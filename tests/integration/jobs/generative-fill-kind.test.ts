// P5-8: the generative_fill job kind with the fake provider, through the real core
// (spec/links-and-sync.md "Generative fill"; D-036). One extend call with the clean source,
// the placement and the size; one generated asset; no layer row changed; a cancel before
// the call or a failure keeps no asset; a failed fill can be tried again; the call is counted.
import fs from 'node:fs'
import { describe, it, expect, afterEach, vi } from 'vitest'
import {
  makeGenerationFixture,
  waitFor,
  ended,
  BACKGROUND_LAYER,
  VARIANT,
  type GenerationFixture,
} from '../generation/generation-fixture'
import { givePicture } from '../generation/cutout-fixture'
import { data } from '../core-fixture'
import { generationDetailsOf } from '../../fixtures/png-chunks'
import { readWireRows } from '@/main/db/rows'
import { greyPng } from '@/main/providers/fake/png'
import { FAKE_IMAGE_MODEL } from '@/main/providers/fake/image'
import { resetFakeBehaviour, setFakeBehaviour } from '@/main/providers/fake/behaviour'
import type { ImageProvider } from '@/main/providers/types'
import { FILL_PROMPT, promptToSend } from '@/shared/generation/prompt'

type ExtendInput = Parameters<ImageProvider['extend']>[0]
const seen = vi.hoisted(() => ({ extend: [] as unknown[] }))
vi.mock('@/main/providers/fake/image', async (original) => {
  const real = await original<typeof import('@/main/providers/fake/image')>()
  const fakeImage = (): ImageProvider => {
    const made = real.fakeImage()
    return {
      ...made,
      extend: (input, opts) => {
        seen.extend.push(input)
        return made.extend(input, opts)
      },
    }
  }
  return { ...real, fakeImage }
})

let f: GenerationFixture
afterEach(() => {
  vi.restoreAllMocks()
  resetFakeBehaviour()
  seen.extend = []
  f.cleanup()
})

const BOX = { x: 40, y: 50, width: 600, height: 700 }

async function ready() {
  f = await makeGenerationFixture({ appVersion: '1.2.3' })
  f.db
    .prepare('UPDATE layer SET geometry = ? WHERE id = ?')
    .run(JSON.stringify({ ...BOX, rotation: 0, crop: null }), BACKGROUND_LAYER)
  const sourceId = await f.importPicture('source.png', greyPng(6, 7))
  givePicture(f.db, BACKGROUND_LAYER, sourceId)
  return sourceId
}

async function start(): Promise<string> {
  const r = await f.user('generation.runFill', { variantId: VARIANT, provider: 'fake' })
  return data<{ jobId: string }>(r).jobId
}

async function run(): Promise<string> {
  const jobId = await start()
  await waitFor(ended(f, jobId))
  return jobId
}

const layers = () => readWireRows(f.db, 'layer')
const assetCount = () => readWireRows(f.db, 'asset').length

describe('the generative_fill job [spec/links-and-sync.md "Generative fill"]', () => {
  it('makes one extend call and stores one generated asset, no layer changed', async () => {
    const sourceId = await ready()
    const clean = await f.core.deps.assets.read(f.project, sourceId)
    const before = layers()
    const jobId = await run()
    const job = f.job(jobId)
    expect(job).toMatchObject({ status: 'succeeded', kind: 'generative_fill' })
    expect(seen.extend).toHaveLength(1)
    const sent = seen.extend[0] as ExtendInput
    expect(sent).toEqual({
      image: clean,
      placement: BOX,
      width: 1080,
      height: 1350,
      prompt: promptToSend(FILL_PROMPT, { pictures: 1 }),
    })
    const ids = (job?.result as { assetIds: string[] }).assetIds
    expect(ids).toHaveLength(1)
    const made = f.asset(ids[0] ?? '')
    expect(made).toMatchObject({
      origin: 'generated',
      genRunId: jobId,
      genProvider: 'fake',
      genModel: FAKE_IMAGE_MODEL,
      width: 1080,
      height: 1350,
    })
    expect(generationDetailsOf(fs.readFileSync(made?.absPath ?? ''))).toMatchObject({
      app: 'Adman',
      appVersion: '1.2.3',
      provider: 'fake',
      kind: 'generative_fill',
      prompt: promptToSend(FILL_PROMPT, { pictures: 1 }),
    })
    expect(layers()).toEqual(before)
  })

  it('sends the bytes AssetService.read gives, not the file on disk', async () => {
    await ready()
    const clean = { bytes: greyPng(3, 2), mime: 'image/png' as const }
    vi.spyOn(f.core.deps.assets, 'read').mockResolvedValue(clean)
    await run()
    expect((seen.extend[0] as ExtendInput).image).toEqual(clean)
  })

  it('a cancel before the call sends nothing and adds no asset', async () => {
    await ready()
    const assets = f.core.deps.assets
    const real = assets.read.bind(assets)
    let release = () => undefined as void
    const held = new Promise<void>((resolve) => (release = resolve))
    // The read in prepare passes; the job's own read waits until the stop was asked for.
    vi.spyOn(assets, 'read')
      .mockImplementationOnce(real)
      .mockImplementationOnce(async (project, id) => {
        await held
        return real(project, id)
      })
    const count = assetCount()
    const jobId = await start()
    await waitFor(() => f.job(jobId)?.status === 'running')
    data(await f.user('job.cancel', { jobId }))
    release()
    await waitFor(ended(f, jobId))
    expect(f.job(jobId)).toMatchObject({ status: 'cancelled', paidCalls: 0 })
    expect(seen.extend).toEqual([])
    expect(assetCount()).toBe(count)
  })

  it('a provider failure ends the job failed and keeps no asset', async () => {
    await ready()
    setFakeBehaviour({ fail: 'offline' })
    const count = assetCount()
    const jobId = await run()
    expect(f.job(jobId)).toMatchObject({ status: 'failed', errorKind: 'offline', result: null })
    expect(assetCount()).toBe(count)
  })

  it('job.retry of a failed fill makes a new fill with the same request, which succeeds', async () => {
    await ready()
    setFakeBehaviour({ fail: 'offline' })
    const failed = await run()
    resetFakeBehaviour()
    const { jobId } = data<{ jobId: string }>(await f.user('job.retry', { jobId: failed }))
    await waitFor(ended(f, jobId))
    expect(f.job(jobId)).toMatchObject({
      kind: 'generative_fill',
      status: 'succeeded',
      layerId: BACKGROUND_LAYER,
      request: f.job(failed)?.request,
    })
  })

  it('counts the one call for a paid provider in campaign.paidCount', async () => {
    await ready()
    const providers = f.core.deps.providers
    const at = providers.findIndex((p) => p.id === 'fake')
    const fake = providers[at]
    if (!fake) throw new Error('no fake provider row')
    providers.splice(at, 1, { ...fake, local: false })
    const jobId = await run()
    expect(f.job(jobId)).toMatchObject({ status: 'succeeded', paidCalls: 1 })
    const count = await f.core.query(
      'campaign.paidCount',
      { projectId: f.projectId, campaignId: 'c1' },
      { actor: 'user' },
    )
    expect(count).toEqual({ ok: true, data: { pictures: 1, videos: 0, text: 0 } })
  })
})
