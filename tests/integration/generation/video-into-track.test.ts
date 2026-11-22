// P7-16: a finished video run (new or picked up) stores the clip with its facts on the asset
// row and its details embedded, and adds it to the variant's track at the first free position
// through clip.addGenerated. Real core, fake video provider, stand-in media tools.
import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, afterEach } from 'vitest'
import { makeGenerationFixture, waitFor, ended, type GenerationFixture } from './generation-fixture'
import { fakeVideo } from '@/main/providers/fake/video'
import { mp4File } from '@/main/providers/fake/mp4'
import { resetFakeBehaviour } from '@/main/providers/fake/behaviour'
import { checkMp4 } from '@/main/providers/video-check'
import { noMediaTool } from '@/main/media/no-media'
import type { MediaTool } from '@/main/media/types'
import type { ProjectContext } from '@/main/commands/types'
import { readWireRows } from '@/main/db/rows'
import type { BackgroundClipRow } from '@/shared/schemas/rows/background-clip'
import type { VideoJobRequest, VideoJobResult } from '@/shared/schemas/jobs/video-generation'

let f: GenerationFixture
afterEach(() => {
  f.cleanup()
  resetFakeBehaviour()
})

const RUN_MS = 10_000
const request: VideoJobRequest = {
  prompt: 'Waves at dusk',
  durationMs: 2_000,
  width: 1080,
  height: 1350,
  start: 'none',
  referenceAssetIds: [],
}
// What the fake's clip holds: 64 by 64, one second, no sound.
const FAKE_FACTS = { width: 64, height: 64, durationMs: 1_000, sound: false }

function enqueue(variantId = 'v1'): string {
  const ctx = { project: f.project } as unknown as ProjectContext
  return f.core.deps.jobs.enqueue(ctx, {
    kind: 'video_generation',
    campaignId: 'c1',
    variantId,
    layerId: null,
    slot: null,
    provider: 'fake',
    model: '',
    request,
    startedBy: 'user',
  })
}

// A row a closed app left running, picked up by projectOpened.
async function leftOver(id: string, variantId: string | null): Promise<void> {
  const { remoteJobId } = await fakeVideo().start({ ...request, image: null, references: [] })
  f.db
    .prepare(
      `INSERT INTO job (id, kind, status, provider, model, request, remote_job_id, campaign_id,
         variant_id, created_at, updated_at)
       VALUES (?, 'video_generation', 'running', 'fake', '', ?, ?, 'c1', ?,
         '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`,
    )
    .run(id, JSON.stringify(request), remoteJobId, variantId)
  await f.core.deps.jobs.projectOpened(f.projectId)
}

async function finished(jobId: string): Promise<VideoJobResult> {
  await waitFor(ended(f, jobId), RUN_MS)
  const job = f.job(jobId)
  expect(job).toMatchObject({ status: 'succeeded' })
  return job?.result as VideoJobResult
}

const clips = (variantId: string) =>
  (readWireRows(f.db, 'background_clip') as BackgroundClipRow[]).filter(
    (c) => c.variantId === variantId,
  )

const storedFile = (assetId: string) =>
  new Uint8Array(fs.readFileSync(path.join(f.assetsDir(), `${assetId}.mp4`)))

// A media tool that writes nothing but hands back `out`, keeping what it was given.
function standIn(out: (bytes: Uint8Array) => Uint8Array | null) {
  const seen: Array<Record<string, unknown>> = []
  const tool: MediaTool = {
    available: () => true,
    embedDetails: async ({ bytes, details }) => (seen.push(details), out(bytes)),
  }
  return { tool, seen }
}

describe('the video job puts its clip on the track [P7-16, A-182]', () => {
  it('lands each clip at the first free position, with its facts on the asset row', async () => {
    f = await makeGenerationFixture()
    const first = await finished(enqueue())
    const second = await finished(enqueue())
    expect(first).toMatchObject({ width: 64, height: 64, durationMs: 1_000, hasSound: false })
    expect(first.clipId).toEqual(expect.any(String))
    const track = clips('v1')
    expect(track.map((c) => [c.id, c.assetId, c.startMs, c.inMs, c.outMs])).toEqual([
      [first.clipId, first.assetId, 0, 0, 1_000],
      [second.clipId, second.assetId, 1_000, 0, 1_000],
    ])
    expect(f.asset(first.assetId)).toMatchObject({
      kind: 'video',
      origin: 'generated',
      width: 64,
      height: 64,
      durationMs: 1_000,
    })
  }, 20_000)

  it('a variant that became an image still gets the clip', async () => {
    f = await makeGenerationFixture()
    const result = await finished(enqueue('v2'))
    expect(clips('v2')).toEqual([expect.objectContaining({ id: result.clipId, startMs: 0 })])
  }, 15_000)

  // variant.delete is refused while a job runs, so the variant is gone the way a picked-up
  // row finds it: deleted while the app was closed (or never in this file), or a null ID.
  it.each([
    ['a variant ID with no row', 'v-gone'],
    ['no variant ID', null],
  ])(
    '%s: the asset is kept with clipId null, and the job succeeds',
    async (_name, variantId) => {
      f = await makeGenerationFixture()
      await leftOver('j-gone', variantId)
      const result = await finished('j-gone')
      expect(result.clipId).toBeNull()
      expect(f.asset(result.assetId)).toMatchObject({ kind: 'video' })
      expect(readWireRows(f.db, 'background_clip')).toHaveLength(0)
    },
    15_000,
  )

  it('a picked-up row adds the clip', async () => {
    f = await makeGenerationFixture()
    await leftOver('j-left', 'v1')
    const result = await finished('j-left')
    expect(clips('v1')).toEqual([expect.objectContaining({ id: result.clipId, startMs: 0 })])
  }, 15_000)
})

describe('the video job writes its details into the clip [P7-16, A-179]', () => {
  it("'pending' with no media tool: the provider's clip is stored as sent", async () => {
    f = await makeGenerationFixture()
    f.core.deps.media = noMediaTool
    const result = await finished(enqueue())
    expect(result.details).toBe('pending')
    expect(storedFile(result.assetId)).toEqual(mp4File(FAKE_FACTS))
  }, 15_000)

  it("'embedded' with a media tool: the written clip is stored, with only the listed details", async () => {
    f = await makeGenerationFixture({ appVersion: '1.2.3' })
    const written = joined(mp4File(FAKE_FACTS), FREE_BOX)
    const { tool, seen } = standIn(() => written)
    f.core.deps.media = tool
    const result = await finished(enqueue())
    expect(result.details).toBe('embedded')
    expect(storedFile(result.assetId)).toEqual(written)
    expect(seen).toEqual([
      {
        app: 'Adman',
        appVersion: '1.2.3',
        provider: 'fake',
        model: 'fake-video',
        prompt: expect.stringContaining('Waves at dusk'),
        kind: 'video_generation',
        createdAt: expect.stringMatching(/^\d{4}-\d\d-\d\dT/),
      },
    ])
    expect(JSON.stringify(seen)).not.toContain(f.root)
  }, 15_000)

  it.each([
    ['changed facts', () => mp4File({ ...FAKE_FACTS, durationMs: 2_000 })],
    ['a file that is not an MP4', () => new Uint8Array([1, 2, 3])],
  ])(
    'a media tool that returns %s: the original is kept, pending',
    async (_name, out) => {
      f = await makeGenerationFixture()
      f.core.deps.media = standIn(out).tool
      const result = await finished(enqueue())
      expect(result.details).toBe('pending')
      expect(checkMp4(storedFile(result.assetId)).durationMs).toBe(1_000)
      expect(storedFile(result.assetId)).toEqual(mp4File(FAKE_FACTS))
    },
    15_000,
  )

  it('a media tool that throws is not a job failure', async () => {
    f = await makeGenerationFixture()
    f.core.deps.media = {
      available: () => true,
      embedDetails: () => Promise.reject(new Error('/private/somewhere failed')),
    }
    const result = await finished(enqueue())
    expect(result.details).toBe('pending')
    expect(JSON.stringify(f.jobs())).not.toContain('/private')
  }, 15_000)
})

// An empty `free` box, so the written clip differs from the sent one but has the same facts.
const FREE_BOX = new Uint8Array([0, 0, 0, 8, 0x66, 0x72, 0x65, 0x65])

function joined(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length)
  out.set(a)
  out.set(b, a.length)
  return out
}
