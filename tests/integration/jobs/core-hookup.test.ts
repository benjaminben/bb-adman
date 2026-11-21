import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, afterEach } from 'vitest'
import { makeFixture, data, type Fixture } from '../core-fixture'
import type { OpenProjectSummary } from '../../../src/shared/schemas/project'

let f: Fixture
afterEach(() => f.cleanup())

async function create(): Promise<OpenProjectSummary> {
  return data<OpenProjectSummary>(
    await f.user('project.create', { name: 'Summer', location: f.projectsDir }),
  )
}

const filePath = () => path.join(f.projectsDir, 'Summer.adman')

// A row as a process that is gone would leave it.
function insertRow(projectId: string, id: string, status: string, request = '{}') {
  f.core.projects
    .requireOpen(projectId)
    .db.prepare(
      `INSERT INTO job (id, kind, status, provider, model, request, created_at, updated_at)
       VALUES (?, 'image_generation', ?, 'gemini', 'm1', ?, ?, ?)`,
    )
    .run(id, status, request, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')
}

function stored(projectId: string, id: string) {
  return f.core.projects
    .requireOpen(projectId)
    .db.prepare('SELECT "status", "error_kind" AS "errorKind" FROM "job" WHERE "id" = ?')
    .get(id)
}

const jobEvents = (id: string) =>
  f.events.flatMap((e) => (e.name === 'job.updated' && e.payload.id === id ? [e.payload] : []))

describe('the core runs the job runner [SPEC 14, 1.38 Y10]', () => {
  it('counts a queued row in an open project', async () => {
    f = makeFixture()
    const p = await create()
    insertRow(p.projectId, 'j1', 'queued')
    expect(f.core.deps.jobs.activeCount(p.projectId)).toBe(1)
  })
})

describe('project.open tells the runner [SPEC 3.6 "Jobs" 1.38, 14 1.38 Y11]', () => {
  it('settles a row a closed process left running when the file is opened', async () => {
    f = makeFixture()
    const p = await create()
    insertRow(p.projectId, 'left1', 'running')
    f.core.closeAll()
    const opened = await f.user('project.open', { filePath: filePath() })
    expect(opened.ok).toBe(true)
    expect(stored(p.projectId, 'left1')).toEqual({ status: 'failed', errorKind: 'other' })
    expect(jobEvents('left1').at(-1)?.status).toBe('failed')
  })

  it('leaves a running row alone when the file is already open', async () => {
    f = makeFixture()
    const p = await create()
    insertRow(p.projectId, 'live1', 'running')
    const opened = await f.user('project.open', { filePath: filePath() })
    expect(opened.ok).toBe(true)
    expect(stored(p.projectId, 'live1')).toEqual({ status: 'running', errorKind: null })
    expect(jobEvents('live1')).toHaveLength(0)
  })

  it('opens a file whose left-over row cannot be read', async () => {
    f = makeFixture()
    const p = await create()
    insertRow(p.projectId, 'bad1', 'running', '{')
    f.core.closeAll()
    const opened = await f.user('project.open', { filePath: filePath() })
    expect(opened.ok).toBe(true)
    expect(stored(p.projectId, 'bad1')).toEqual({ status: 'failed', errorKind: 'other' })
  })

  it('still opens when settling fails, with one warn line naming the error only', async () => {
    f = makeFixture()
    const p = await create()
    f.core.closeAll()
    f.core.deps.jobs.projectOpened = async () => {
      throw new TypeError('SECRETWORD in the message')
    }
    const opened = await f.user('project.open', { filePath: filePath() })
    expect(opened.ok).toBe(true)
    const lines = f
      .readLogs()
      .trim()
      .split('\n')
      .map((l) => JSON.parse(l) as Record<string, unknown>)
      .filter((l) => l.name === 'job.projectOpened')
    expect(lines).toEqual([
      expect.objectContaining({
        level: 'warn',
        event: 'job',
        projectId: p.projectId,
        ok: false,
        message: 'Jobs left running could not be settled.',
        context: { error: { name: 'TypeError' } },
      }),
    ])
    expect(f.readLogs()).not.toContain('SECRETWORD')
    expect(fs.existsSync(filePath())).toBe(true)
  })
})
