import { describe, it, expect, afterEach } from 'vitest'
import { makeComfyFixture, type ComfyFixture } from '../generation/comfy-fixture'
import { startComfyStandIn, type StandIn } from '../../helpers/comfy-stand-in'
import { WORKFLOWS } from '../../../src/main/providers/comfyui/workflows'

let f: ComfyFixture
let stand: StandIn
afterEach(async () => {
  f.cleanup()
  await stand.close()
})

const REQUEST = JSON.stringify({
  prompt: 'A bottle',
  referenceAssetIds: [],
  count: 1,
  width: 1080,
  height: 1350,
})

// A failed ComfyUI picture row, as a run that ended would leave it.
async function failedRow(devTools: boolean): Promise<void> {
  stand = await startComfyStandIn()
  f = await makeComfyFixture({ devTools, origin: stand.origin })
  f.db
    .prepare(
      `INSERT INTO job (id, kind, status, campaign_id, variant_id, slot, provider, model, request,
        paid_calls, started_by, error_kind, error_reason, error_detail, created_at, updated_at)
       VALUES ('old', 'image_generation', 'failed', 'c1', 'v1', 'background', 'comfyui', '', ?,
        0, 'user', 'offline', 'no_answer', 'x', 'x', 'x')`,
    )
    .run(REQUEST)
}

const retry = () => f.user('job.retry', { jobId: 'old' })

describe('job.retry runs the ComfyUI checks [SPEC 14 1.53 G-2, 1.41, 6.10.11]', () => {
  it('with dev tools off and only trial picture workflows: comfy_job_not_offered, no new row', async () => {
    expect(WORKFLOWS.some((w) => w.job === 'image' && w.status === 'proven')).toBe(false)
    await failedRow(false)
    const r = (await retry()) as { ok: boolean; error?: { details?: { reason?: string } } }
    expect(r.ok).toBe(false)
    expect(r.error?.details?.reason).toBe('comfy_job_not_offered')
    expect(f.jobs()).toHaveLength(1)
  })

  it('with dev tools on, the same row makes a new queued job (the hand-test path)', async () => {
    await failedRow(true)
    const r = (await retry()) as { ok: boolean; data?: { jobId: string } }
    expect(r.ok).toBe(true)
    const jobs = f.jobs()
    expect(jobs).toHaveLength(2)
    expect(jobs.find((j) => j.id === r.data?.jobId)).toMatchObject({ provider: 'comfyui' })
  })
})
