// P4-11: the cutout job kind with the fake provider, through the real core (spec/ai-jobs.md
// "Cut-out"; FR-307). One new asset with the details embedded; the source asset unchanged;
// the source sent is the clean PNG AssetService.read gives, not the file on disk.
import fs from 'node:fs'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { makeGenerationFixture, waitFor, ended, BACKGROUND_LAYER, type GenerationFixture } from './generation-fixture'
import { cutOutInput, givePicture } from './cutout-fixture'
import { data } from '../core-fixture'
import { generationDetailsOf } from '../../fixtures/png-chunks'
import { greyPng } from '@/main/providers/fake/png'
import { FAKE_CUTOUT_MODEL } from '@/main/providers/fake/cutout'

let f: GenerationFixture
afterEach(() => {
  vi.restoreAllMocks()
  f.cleanup()
})

async function ready() {
  f = await makeGenerationFixture({ appVersion: '1.2.3' })
  const sourceId = await f.importPicture('source.png', greyPng(8, 6))
  givePicture(f.db, BACKGROUND_LAYER, sourceId)
  return sourceId
}

async function run() {
  const { jobId } = data<{ jobId: string }>(await f.user('generation.cutOut', cutOutInput()))
  await waitFor(ended(f, jobId))
  return jobId
}

describe('the cutout job [FR-307]', () => {
  it('makes one new asset from the source, with the details embedded, the source unchanged', async () => {
    const sourceId = await ready()
    const before = f.asset(sourceId)
    const sourceBytes = fs.readFileSync(before?.absPath ?? '')
    const conversions = f.toPngCalls.length
    const jobId = await run()
    const job = f.job(jobId)
    expect(job).toMatchObject({ status: 'succeeded', paidCalls: 0 })
    const ids = (job?.result as { assetIds: string[] }).assetIds
    expect(ids).toHaveLength(1)
    const made = f.asset(ids[0] ?? '')
    expect(made).toMatchObject({
      origin: 'generated',
      genRunId: jobId,
      genPrompt: null,
      genProvider: 'fake',
      genModel: FAKE_CUTOUT_MODEL,
      width: 8,
      height: 6,
    })
    // Two reads of the source (prepare, then the job; A-55), then the provider's answer: a
    // PNG with alpha (colour type 6) goes through toPng.
    expect(f.toPngCalls).toHaveLength(conversions + 3)
    expect(f.toPngCalls.at(-1)?.[25]).toBe(6)
    expect(generationDetailsOf(fs.readFileSync(made?.absPath ?? ''))).toMatchObject({
      app: 'Adman',
      appVersion: '1.2.3',
      provider: 'fake',
      model: FAKE_CUTOUT_MODEL,
      prompt: '',
      kind: 'cutout',
    })
    expect(f.asset(sourceId)).toEqual(before)
    expect(fs.readFileSync(before?.absPath ?? '')).toEqual(sourceBytes)
  })

  it('sends the bytes AssetService.read gives, not the file on disk', async () => {
    await ready()
    const clean = greyPng(7, 3)
    vi.spyOn(f.core.deps.assets, 'read').mockResolvedValue({ bytes: clean, mime: 'image/png' })
    const jobId = await run()
    const [id] = (f.job(jobId)?.result as { assetIds: string[] }).assetIds
    expect(f.asset(id ?? '')).toMatchObject({ width: 7, height: 3 })
  })

  it('ends picture_missing when the source is deleted after it was queued', async () => {
    const sourceId = await ready()
    const file = f.asset(sourceId)?.absPath ?? ''
    const assets = f.core.deps.assets
    const real = assets.read.bind(assets)
    // The read in prepare passes; the file is gone before the job's own read.
    vi.spyOn(assets, 'read').mockImplementationOnce(async (project, id) => {
      const bytes = await real(project, id)
      fs.rmSync(file)
      return bytes
    })
    const jobId = await run()
    expect(f.job(jobId)).toMatchObject({
      status: 'failed',
      errorKind: 'other',
      errorReason: 'picture_missing',
    })
  })
})
