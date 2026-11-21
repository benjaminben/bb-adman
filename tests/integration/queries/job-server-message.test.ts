import { describe, it, expect, afterEach } from 'vitest'
import { makeFixture, data, type Fixture } from '../core-fixture'
import { COMFY_INFO_DENIED } from '../../../src/main/queries/comfy'

let f: Fixture
afterEach(() => f.cleanup())

type Row = { provider: string; status: string; reason: string | null; detail: string | null }

async function withJob(row: Row): Promise<string> {
  f = makeFixture()
  const created = await f.core.bus.execute(
    'project.create',
    { name: 'P', location: f.root },
    { actor: 'user' },
  )
  const { projectId } = data<{ projectId: string }>(created)
  const db = f.core.projects.requireOpen(projectId).db
  db.prepare(
    `INSERT INTO job (id, kind, status, provider, model, request, paid_calls, started_by,
      error_kind, error_reason, error_detail, created_at, updated_at)
     VALUES ('j1', 'image_generation', ?, ?, '', '{}', 0, 'user', 'other', ?, ?, 'x', 'x')`,
  ).run(row.status, row.provider, row.reason, row.detail)
  return projectId
}

const ask = (projectId: string, actor: 'user' | 'agent' = 'user') =>
  f.core.query('job.getServerMessage', { projectId, jobId: 'j1' }, { actor })

describe('job.getServerMessage [SPEC 4.3, 6.10.9; FR-267] (security class)', () => {
  it.each(['server_refused', 'run_failed', 'out_of_memory'])(
    'gives the cleaned server text of a failed ComfyUI job with reason %s',
    async (reason) => {
      const projectId = await withJob({
        provider: 'comfyui',
        status: 'failed',
        reason,
        detail: 'ValueError: bad sampler',
      })
      expect(await ask(projectId)).toEqual({ ok: true, data: { text: 'ValueError: bad sampler' } })
    },
  )

  it('gives null when the detail is the app own words, not the server', async () => {
    const projectId = await withJob({
      provider: 'comfyui',
      status: 'failed',
      reason: 'no_answer',
      detail: 'No answer in 10 s',
    })
    expect(await ask(projectId)).toEqual({ ok: true, data: { text: null } })
  })

  it('gives null for a provider whose serverText is false', async () => {
    const projectId = await withJob({
      provider: 'gemini',
      status: 'failed',
      reason: 'server_refused',
      detail: 'secret words',
    })
    expect(await ask(projectId)).toEqual({ ok: true, data: { text: null } })
  })

  it('gives null for an empty detail and for a job that is not there', async () => {
    const projectId = await withJob({
      provider: 'comfyui',
      status: 'failed',
      reason: 'server_refused',
      detail: '',
    })
    expect(await ask(projectId)).toEqual({ ok: true, data: { text: null } })
    const other = await f.core.query(
      'job.getServerMessage',
      { projectId, jobId: 'nope' },
      { actor: 'user' },
    )
    expect(other).toEqual({ ok: true, data: { text: null } })
  })

  it('refuses an agent with AGENT_DENIED and gives it no text [SPEC 6.10.9 "Never to an agent"]', async () => {
    const projectId = await withJob({
      provider: 'comfyui',
      status: 'failed',
      reason: 'server_refused',
      detail: 'the words',
    })
    const reply = await ask(projectId, 'agent')
    expect(reply).toMatchObject({ ok: false, error: { code: 'AGENT_DENIED' } })
    expect(JSON.stringify(reply)).not.toContain('the words')
    expect(COMFY_INFO_DENIED).not.toBe('')
  })
})
