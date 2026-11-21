// CU-6a end to end: generation.startVideo with provider comfyui against the stand-in, through
// the real core, job runner and asset store (SPEC 4.2, 6.10.7, 14 1.41 CU-6a). The adapter and
// the job poll on their real 2 s clocks.
import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, afterEach } from 'vitest'
import { makeComfyFixture, type ComfyFixture } from './comfy-fixture'
import { waitFor } from './generation-fixture'
import { startComfyStandIn, type StandIn } from '../../helpers/comfy-stand-in'
import {
  RESULT_MP4,
  finishRun,
  serveNeeds,
  serveVideo,
  videoHistoryEntry,
} from '../../helpers/comfy-run'
import { data } from '../core-fixture'
import { assetsDirOf } from '../../../src/main/assets/service'
import { h3TextToVideo as h3 } from '../../../src/main/providers/comfyui/workflows/h3'
import type { VideoJobResult } from '../../../src/shared/schemas/jobs/video-generation'

let f: ComfyFixture
let stand: StandIn | null = null
afterEach(async () => {
  f.cleanup()
  await stand?.close()
  stand = null
})

const RUN_MS = 15_000
const ask = {
  variantId: 'v1',
  prompt: 'A bottle on a rock',
  durationMs: 2_000,
  provider: 'comfyui',
  start: 'none',
  useReferences: false,
  referenceAssetIds: [],
}
const ended = (id: string) => () =>
  ['succeeded', 'failed', 'cancelled'].includes(f.job(id)?.status ?? '')

async function ready(devTools = true): Promise<void> {
  stand = await startComfyStandIn()
  serveNeeds(stand)
  serveVideo(stand)
  f = await makeComfyFixture({ devTools, origin: stand.origin })
}

function projectBytes(): string {
  const file = f.projectFile()
  return ['', '-wal', '-shm', '-journal']
    .map((end) => `${file}${end}`)
    .filter((p) => fs.existsSync(p))
    .map((p) => fs.readFileSync(p).toString('latin1'))
    .join('')
}

describe('generation.startVideo with comfyui against the stand-in [SPEC 14 CU-6a]', () => {
  it('stores the checked MP4 as sent, with hasSound, paid_calls 0 and both IDs', async () => {
    await ready()
    const { jobId } = data<{ jobId: string }>(await f.user('generation.startVideo', ask))
    await waitFor(() => stand?.seen.some((r) => r.path === '/prompt') ?? false, RUN_MS)
    const sent = stand?.seen.find((r) => r.path === '/prompt')?.body.toString('utf8') ?? '{}'
    const body = JSON.parse(sent) as {
      prompt_id: string
      prompt: Record<string, { inputs: Record<string, unknown> }>
    }
    expect(body.prompt['5']?.inputs.length).toBe(56)
    const entry = videoHistoryEntry(h3.slots.outputNode, body.prompt_id)
    if (stand) finishRun(stand, body.prompt_id, entry)
    await waitFor(ended(jobId), RUN_MS)
    const job = f.job(jobId)
    expect(job).toMatchObject({
      status: 'succeeded',
      kind: 'video_generation',
      provider: 'comfyui',
      campaignId: 'c1',
      variantId: 'v1',
      paidCalls: 0,
      remoteJobId: body.prompt_id,
    })
    const result = job?.result as VideoJobResult
    expect(result).toMatchObject({ width: 384, height: 672, hasSound: true, details: 'pending' })
    const stored = fs.readFileSync(path.join(assetsDirOf(f.project), `${result.assetId}.mp4`))
    expect(new Uint8Array(stored)).toEqual(new Uint8Array(RESULT_MP4))
    expect(f.asset(result.assetId)).toMatchObject({ kind: 'video', mime: 'video/mp4' })
    expect(projectBytes()).not.toContain(stand?.origin ?? '')
    expect(projectBytes()).not.toContain('127.0.0.1')
  }, 25_000)

  it('no address saved: comfy_address_needed, before a job row', async () => {
    f = await makeComfyFixture({ devTools: true })
    expect(await f.user('generation.startVideo', ask)).toMatchObject({
      ok: false,
      error: { code: 'RULE_VIOLATION', details: { reason: 'comfy_address_needed' } },
    })
    expect(f.jobs()).toEqual([])
  })

  it('with dev tools off, the trial workflow is refused: comfy_job_not_offered', async () => {
    await ready(false)
    expect(await f.user('generation.startVideo', ask)).toMatchObject({
      ok: false,
      error: { code: 'RULE_VIOLATION', details: { reason: 'comfy_job_not_offered' } },
    })
    expect(f.jobs()).toEqual([])
    expect(stand?.seen).toEqual([])
  })

  it('a clip longer than the workflow makes: video_too_long with maxMs', async () => {
    await ready()
    const reply = await f.user('generation.startVideo', { ...ask, durationMs: 15_001 })
    expect(reply).toMatchObject({
      ok: false,
      error: { code: 'RULE_VIOLATION', details: { reason: 'video_too_long', maxMs: 15_000 } },
    })
    expect(f.jobs()).toEqual([])
  })

  it('an agent is refused, and nothing is sent', async () => {
    await ready()
    expect(await f.agent('generation.startVideo', ask)).toMatchObject({ ok: false })
    expect(f.jobs()).toEqual([])
    expect(stand?.seen).toEqual([])
  })
})
