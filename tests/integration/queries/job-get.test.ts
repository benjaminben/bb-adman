import { describe, it, expect, afterEach } from 'vitest'
import { makeFixture, data, type Fixture } from '../core-fixture'
import type { JobRow } from '@/shared/schemas/rows/job'

let f: Fixture
afterEach(() => f.cleanup())

async function withJob(): Promise<string> {
  f = makeFixture()
  const created = await f.user('project.create', { name: 'P', location: f.projectsDir })
  const { projectId } = data<{ projectId: string }>(created)
  f.core.projects
    .requireOpen(projectId)
    .db.prepare(
      `INSERT INTO job (id, kind, status, provider, model, request, paid_calls, started_by,
        error_kind, error_reason, error_detail, created_at, updated_at)
       VALUES ('j1', 'image_generation', 'failed', 'comfyui', 'm', '{}', 0, 'agent', 'offline',
        'no_answer', 'main-only words', '2026-01-01T00:00:00Z', '2026-01-01T00:00:01Z')`,
    )
    .run()
  return projectId
}

const get = (projectId: string, jobId: string, actor: 'user' | 'agent') =>
  f.core.query('job.get', { projectId, jobId }, { actor })

describe('job.get [SPEC api-queries-events; MCP-D]', () => {
  it('gives the one wire row to both actors, without error_detail', async () => {
    const projectId = await withJob()
    for (const actor of ['user', 'agent'] as const) {
      const row = data<JobRow>(await get(projectId, 'j1', actor))
      expect(row).toMatchObject({ id: 'j1', status: 'failed', errorReason: 'no_answer' })
      expect(JSON.stringify(row)).not.toContain('main-only words')
    }
  })

  it('gives NOT_FOUND "That job was not found." for an unknown job ID', async () => {
    const projectId = await withJob()
    const r = await get(projectId, 'made-up-job', 'agent')
    expect(r).toMatchObject({
      ok: false,
      error: { code: 'NOT_FOUND', message: 'That job was not found.' },
    })
  })

  it('gives NOT_FOUND for a project that is not open', async () => {
    const projectId = await withJob()
    const r = await get(`${projectId}-not`, 'j1', 'agent')
    expect(r).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } })
  })

  it('gives INVALID_INPUT with no job ID', async () => {
    const projectId = await withJob()
    const r = await f.core.query('job.get', { projectId }, { actor: 'agent' })
    expect(r).toMatchObject({ ok: false, error: { code: 'INVALID_INPUT' } })
  })
})
