// R2E-7 (spec/phases/round-2-editor.md D5): generation.startVideo's user input names the layer
// the clip replaces. It must be the variant's background layer, else INVALID_INPUT and no job.
// It is stored in job.layer_id, and job.retry keeps it. An agent's call never names one.
import { describe, it, expect, afterEach } from 'vitest'
import {
  makeGenerationFixture,
  waitFor,
  ended,
  BACKGROUND_LAYER,
  TEXT_LAYER,
  OTHER_VARIANT,
  VARIANT,
  type GenerationFixture,
} from '../generation/generation-fixture'
import { data } from '../core-fixture'
import { resetFakeBehaviour } from '@/main/providers/fake/behaviour'

let f: GenerationFixture
afterEach(() => {
  f.cleanup()
  resetFakeBehaviour()
})

const ask = {
  variantId: VARIANT,
  prompt: 'Waves on a rock',
  durationMs: 2_000,
  provider: 'fake',
  start: 'none',
  useReferences: false,
  referenceAssetIds: [],
}
const start = (input: Record<string, unknown> = {}) =>
  f.user('generation.startVideo', { ...ask, ...input })

// A layer of the given type copied from the background layer's row.
function copyLayer(id: string, variantId: string, type: string): void {
  f.db
    .prepare(
      `INSERT INTO layer (id, variant_id, key, type, slot, name, z, copy, style, geometry, source,
         timing, animation, revs, synced_revs)
       SELECT ?, ?, ?, ?, NULL, name, z, copy, style, geometry, source, timing, animation, revs,
         synced_revs
       FROM layer WHERE id = ?`,
    )
    .run(id, variantId, id, type, BACKGROUND_LAYER)
}

const REFUSED = 'Videos are made on the background layer.'

describe('generation.startVideo layerId [R2E-7, D5]', () => {
  it('stores the background layer on the job', async () => {
    f = await makeGenerationFixture()
    const { jobId } = data<{ jobId: string }>(await start({ layerId: BACKGROUND_LAYER }))
    expect(f.job(jobId)).toMatchObject({ layerId: BACKGROUND_LAYER, variantId: VARIANT })
    await waitFor(ended(f, jobId), 10_000)
  })

  it('stores no layer when none is named', async () => {
    f = await makeGenerationFixture()
    const { jobId } = data<{ jobId: string }>(await start())
    expect(f.job(jobId)).toMatchObject({ layerId: null })
    await waitFor(ended(f, jobId), 10_000)
  })

  it.each([
    ['an image layer of the variant', () => (copyLayer('l-image', VARIANT, 'image'), 'l-image')],
    ['a text layer of the variant', () => TEXT_LAYER],
    [
      "another variant's background layer",
      () => (copyLayer('l-bg-2', OTHER_VARIANT, 'background'), 'l-bg-2'),
    ],
    ['a layer that is not there', () => 'l-gone'],
  ])('refuses %s with INVALID_INPUT and makes no job', async (_, layer) => {
    f = await makeGenerationFixture()
    const r = await start({ layerId: layer() })
    expect(r).toEqual({ ok: false, error: { code: 'INVALID_INPUT', message: REFUSED } })
    expect(f.jobs()).toEqual([])
  })

  it('job.retry keeps the layer', async () => {
    f = await makeGenerationFixture()
    f.db
      .prepare(
        `INSERT INTO job (id, kind, status, provider, model, request, campaign_id, variant_id,
           layer_id, created_at, updated_at)
         VALUES ('j-old', 'video_generation', 'failed', 'fake', '', ?, 'c1', ?, ?,
           '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`,
      )
      .run(
        JSON.stringify({ ...ask, width: 1080, height: 1350, prompt: 'Waves' }),
        VARIANT,
        BACKGROUND_LAYER,
      )
    const { jobId } = data<{ jobId: string }>(await f.user('job.retry', { jobId: 'j-old' }))
    expect(f.job(jobId)).toMatchObject({ layerId: BACKGROUND_LAYER, variantId: VARIANT })
    await waitFor(ended(f, jobId), 10_000)
  })

  it("ignores an agent's layerId: the job has no layer", async () => {
    f = await makeGenerationFixture()
    const asUser = (name: string, input: Record<string, unknown>) =>
      f.core.bus.execute(name, input, { actor: 'user' })
    data(await asUser('agentRuns.setAllowed', { provider: 'fake', allowed: true }))
    const input = { projectId: f.projectId, ...ask, layerId: BACKGROUND_LAYER }
    const r = await f.core.bus.execute('generation.startVideo', input, { actor: 'agent' })
    const { jobId } = data<{ jobId: string }>(r)
    expect(f.job(jobId)).toMatchObject({ layerId: null, startedBy: 'agent' })
    await waitFor(ended(f, jobId), 10_000)
  })
})
