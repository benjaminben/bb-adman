import { describe, it, expect, afterEach } from 'vitest'
import { makeRunnerFixture, waitFor, type RunnerFixture } from './runner-fixture'
import { readJobErrorDetail } from '../../../src/main/db/rows'

const fixtures: RunnerFixture[] = []
function fixture(): RunnerFixture {
  const f = makeRunnerFixture()
  fixtures.push(f)
  return f
}
afterEach(() => {
  while (fixtures.length) fixtures.pop()?.cleanup()
})

// A row as a process that was killed would have left it.
function leftOver(
  x: RunnerFixture,
  id: string,
  status: 'queued' | 'running',
  provider: string,
  kind = 'image_generation',
  remoteJobId: string | null = null,
) {
  x.project.db
    .prepare(
      `INSERT INTO job (id, kind, status, provider, model, request, remote_job_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'm1', '{}', ?, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`,
    )
    .run(id, kind, status, provider, remoteJobId)
}

describe('job runner on project open [SPEC 3.6 "Jobs" item 6, 6.11 [1.24]]', () => {
  it('fails a job left running as interrupted, offered for retry', async () => {
    const x = fixture()
    leftOver(x, 'j1', 'running', 'gemini')
    await x.jobs.projectOpened(x.projectId)
    expect(x.row('j1')).toMatchObject({ status: 'failed', errorKind: 'other', errorReason: null })
    expect(readJobErrorDetail(x.project.db, 'j1')).toBe('interrupted')
    expect(x.jobEvents('j1').at(-1)?.status).toBe('failed')
  })

  it('cancels a job left queued: it never sent a call', async () => {
    const x = fixture()
    leftOver(x, 'j2', 'queued', 'gemini')
    await x.jobs.projectOpened(x.projectId)
    expect(x.row('j2')?.status).toBe('cancelled')
    expect(x.f.calls).toBe(0)
  })

  it('never picks up a ComfyUI job: failed with reason lost_contact', async () => {
    const x = fixture()
    leftOver(x, 'j3', 'running', 'comfyui')
    leftOver(x, 'j4', 'queued', 'comfyui')
    await x.jobs.projectOpened(x.projectId)
    for (const id of ['j3', 'j4']) {
      expect(x.row(id)).toMatchObject({
        status: 'failed',
        errorKind: 'offline',
        errorReason: 'lost_contact',
      })
    }
    expect(x.f.calls).toBe(0)
  })

  it('resumes a video job that has a remote run ID', async () => {
    const x = fixture()
    leftOver(x, 'j5', 'running', 'fake', 'video_generation', 'fake-video-9')
    await x.jobs.projectOpened(x.projectId)
    await waitFor(() => x.row('j5')?.status === 'succeeded')
    expect(x.f.calls).toBe(1)
  })
})
