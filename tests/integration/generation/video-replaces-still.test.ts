// R2E-7 (spec/phases/round-2-editor.md D5): a video run started on the background layer puts
// its clip in the place of the post's still. Real core, fake video provider. A run with no
// layer (an agent's) adds at the first free position as before.
import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, afterEach } from 'vitest'
import {
  makeGenerationFixture,
  waitFor,
  ended,
  BACKGROUND_LAYER,
  VARIANT,
  type GenerationFixture,
} from './generation-fixture'
import { data } from '../core-fixture'
import { resetFakeBehaviour } from '@/main/providers/fake/behaviour'
import { greyPng } from '@/main/providers/fake/png'
import { readWireRows } from '@/main/db/rows'
import type { BackgroundClipRow } from '@/shared/schemas/rows/background-clip'
import type { VideoJobResult } from '@/shared/schemas/jobs/video-generation'

let f: GenerationFixture
afterEach(() => {
  f.cleanup()
  resetFakeBehaviour()
})

const RUN_MS = 10_000
const ask = {
  variantId: VARIANT,
  prompt: 'Waves at dusk',
  durationMs: 2_000,
  provider: 'fake',
  start: 'none',
  useReferences: false,
  referenceAssetIds: [],
}

const clips = () =>
  (readWireRows(f.db, 'background_clip') as BackgroundClipRow[]).filter(
    (c) => c.variantId === VARIANT,
  )

// A post of 8 seconds whose background shows a picture, with the still made from it.
async function postWithStill(): Promise<BackgroundClipRow> {
  f = await makeGenerationFixture()
  const file = path.join(f.root, 'beach.png')
  fs.writeFileSync(file, greyPng(5, 5))
  const imported = await f.user('asset.import', { paths: [file], library: 'asset', copy: false })
  const [assetId] = data<{ assetIds: string[] }>(imported).assetIds
  f.db.prepare('UPDATE variant SET duration_ms = 8000 WHERE id = ?').run(VARIANT)
  f.db
    .prepare('UPDATE layer SET source = ? WHERE id = ?')
    .run(JSON.stringify({ assetId }), BACKGROUND_LAYER)
  data(await f.user('clip.add', { variantId: VARIANT, assetId }))
  const [still] = clips()
  expect(still).toMatchObject({ assetId, startMs: 0, outMs: 8000 })
  return still as BackgroundClipRow
}

async function finished(input: Record<string, unknown>): Promise<VideoJobResult> {
  const { jobId } = data<{ jobId: string }>(await f.user('generation.startVideo', input))
  await waitFor(ended(f, jobId), RUN_MS)
  const job = f.job(jobId)
  expect(job).toMatchObject({ status: 'succeeded' })
  return job?.result as VideoJobResult
}

describe('a video run on the background layer replaces the still [R2E-7, D5]', () => {
  it('leaves one clip at 0 of the whole fake clip, and says replacedStill', async () => {
    await postWithStill()
    const result = await finished({ ...ask, layerId: BACKGROUND_LAYER })
    expect(result).toMatchObject({ replacedStill: true, clipId: expect.any(String) })
    expect(clips().map((c) => [c.id, c.assetId, c.startMs, c.inMs, c.outMs])).toEqual([
      [result.clipId, result.assetId, 0, 0, 1_000],
    ])
  }, 20_000)

  it('a run with no layer adds the clip after the still, replacedStill false', async () => {
    const still = await postWithStill()
    const result = await finished(ask)
    expect(result).toMatchObject({ replacedStill: false })
    expect(clips().map((c) => [c.id, c.startMs])).toEqual([
      [still.id, 0],
      [result.clipId, 8000],
    ])
  }, 20_000)
})
