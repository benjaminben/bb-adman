// CU-6a, 14 1.53 "Passed on to CU-6a" (security class): job.retry of a ComfyUI video job makes
// the same checks as generation.startVideo, before a job row.
import fs from 'node:fs'
import path from 'node:path'
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

describe('job.retry of a ComfyUI video job from a picture [SPEC 14 1.60 CU-6b N-5] (security class)', () => {
  function failedPictureVideo(id: string, picture: Record<string, unknown>): void {
    f.db
      .prepare(
        `INSERT INTO job (id, kind, status, provider, model, request, campaign_id, variant_id,
           created_at, updated_at)
         VALUES (?, 'video_generation', 'failed', 'comfyui', '', ?, 'c1', 'v1',
           '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`,
      )
      .run(id, JSON.stringify({ ...request, ...picture }))
  }

  const retried = () => f.user('job.retry', { jobId: 'j-old' })

  it("the first frame's file is gone: refused with MISSING_FILE, no new job row", async () => {
    f = await makeComfyFixture({ devTools: true, origin: 'http://192.0.2.5:8188' })
    const id = await f.importPicture('pics', 'shoe.png')
    fs.rmSync(path.join(f.root, 'pics', 'shoe.png'))
    failedPictureVideo('j-old', { start: 'first_frame', referenceAssetIds: [id] })
    expect(await retried()).toMatchObject({ ok: false, error: { code: 'MISSING_FILE' } })
    expect(f.jobs().map((j) => j.id)).toEqual(['j-old'])
  })

  it('a stored reference start is checked against the reference workflow: two IDs are too many', async () => {
    f = await makeComfyFixture({ devTools: true, origin: 'http://192.0.2.5:8188' })
    const a = await f.importPicture('pics', 'a.png')
    const b = await f.importPicture('pics', 'b.png')
    failedPictureVideo('j-old', { start: 'none', referenceAssetIds: [a, b] })
    expect(await retried()).toMatchObject({
      ok: false,
      error: { code: 'RULE_VIOLATION', details: { reason: 'too_many_references', max: 1 } },
    })
    expect(f.jobs().map((j) => j.id)).toEqual(['j-old'])
  })

  it('a stored first frame with two IDs: INVALID_INPUT, no new job row', async () => {
    f = await makeComfyFixture({ devTools: true, origin: 'http://192.0.2.5:8188' })
    failedPictureVideo('j-old', { start: 'first_frame', referenceAssetIds: ['a', 'b'] })
    expect(await retried()).toMatchObject({ ok: false, error: { code: 'INVALID_INPUT' } })
    expect(f.jobs().map((j) => j.id)).toEqual(['j-old'])
  })

  it('with dev tools off, a stored first-frame start is not offered', async () => {
    f = await makeComfyFixture({ devTools: false, origin: 'http://192.0.2.5:8188' })
    const id = await f.importPicture('pics', 'shoe.png')
    failedPictureVideo('j-old', { start: 'first_frame', referenceAssetIds: [id] })
    expect(await retried()).toMatchObject({
      ok: false,
      error: { code: 'RULE_VIOLATION', details: { reason: 'comfy_job_not_offered' } },
    })
    expect(f.jobs().map((j) => j.id)).toEqual(['j-old'])
  })
})

// [1.60 N-5] Review CU-6b-M D-1: the picture checks run whatever the old row's status, so a
// row that ends between prepare and run is never retried unchecked.
describe('job.retry of a running ComfyUI picture-start row [SPEC 14 1.60 CU-6b N-5] (security class)', () => {
  function runningPictureVideo(id: string, assetId: string): void {
    f.db
      .prepare(
        `INSERT INTO job (id, kind, status, provider, model, request, campaign_id, variant_id,
           created_at, updated_at)
         VALUES (?, 'video_generation', 'running', 'comfyui', '', ?, 'c1', 'v1',
           '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`,
      )
      .run(id, JSON.stringify({ ...request, start: 'first_frame', referenceAssetIds: [assetId] }))
  }

  it("the first frame's file is gone: the picture check refuses it with MISSING_FILE", async () => {
    f = await makeComfyFixture({ devTools: true, origin: 'http://192.0.2.5:8188' })
    const id = await f.importPicture('pics', 'shoe.png')
    fs.rmSync(path.join(f.root, 'pics', 'shoe.png'))
    runningPictureVideo('j-old', id)
    expect(await f.user('job.retry', { jobId: 'j-old' })).toMatchObject({
      ok: false,
      error: { code: 'MISSING_FILE' },
    })
    expect(f.jobs().map((j) => j.id)).toEqual(['j-old'])
  })

  it('the picture passes the checks: still refused with job_wrong_state, no new job row', async () => {
    f = await makeComfyFixture({ devTools: true, origin: 'http://192.0.2.5:8188' })
    const id = await f.importPicture('pics', 'shoe.png')
    runningPictureVideo('j-old', id)
    expect(await f.user('job.retry', { jobId: 'j-old' })).toMatchObject({
      ok: false,
      error: { code: 'RULE_VIOLATION', details: { reason: 'job_wrong_state' } },
    })
    expect(f.jobs().map((j) => j.id)).toEqual(['j-old'])
  })
})
