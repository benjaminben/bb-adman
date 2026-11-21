// CU-6a, 14 1.53 "Passed on to CU-6a" (security class): job.retry of a ComfyUI video job makes
// the same checks as generation.startVideo, before a job row.
import { describe, it, expect, afterEach } from 'vitest'
import { makeComfyFixture, type ComfyFixture } from './comfy-fixture'

let f: ComfyFixture
afterEach(() => f.cleanup())

const request = {
  prompt: 'p',
  durationMs: 2_000,
  width: 1080,
  height: 1350,
  start: 'none',
  referenceAssetIds: [],
}

function failedVideo(id: string): void {
  f.db
    .prepare(
      `INSERT INTO job (id, kind, status, provider, model, request, campaign_id, variant_id,
         created_at, updated_at)
       VALUES (?, 'video_generation', 'failed', 'comfyui', '', ?, 'c1', 'v1',
         '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`,
    )
    .run(id, JSON.stringify(request))
}

describe('job.retry of a ComfyUI video job [SPEC 14 1.53]', () => {
  it('with dev tools off and only trial video workflows: refused, no new job row', async () => {
    f = await makeComfyFixture({ devTools: false, origin: 'http://192.0.2.5:8188' })
    failedVideo('j-old')
    expect(await f.user('job.retry', { jobId: 'j-old' })).toMatchObject({
      ok: false,
      error: { code: 'RULE_VIOLATION', details: { reason: 'comfy_job_not_offered' } },
    })
    expect(f.jobs().map((j) => j.id)).toEqual(['j-old'])
  })
})
