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

const MARKER = 'PLANTEDWORD'

// A row as a process that is gone, or a file made elsewhere, would leave it.
function insertRow(
  x: RunnerFixture,
  id: string,
  status: 'queued' | 'running',
  request: string,
  result: string | null = null,
  createdAt = '2026-01-01T00:00:00.000Z',
) {
  x.project.db
    .prepare(
      `INSERT INTO job (id, kind, status, provider, model, request, result, created_at, updated_at)
       VALUES (?, 'image_generation', ?, 'gemini', 'm1', ?, ?, ?, ?)`,
    )
    .run(id, status, request, result, createdAt, createdAt)
}

// Read with SQL: the bad row cannot be read through rows.ts.
function stored(x: RunnerFixture, id: string) {
  return x.project.db
    .prepare('SELECT "status", "error_kind" AS "errorKind" FROM "job" WHERE "id" = ?')
    .get(id)
}

const done = (x: RunnerFixture, id: string) => () =>
  ['succeeded', 'failed', 'cancelled'].includes(x.row(id)?.status ?? '')

describe('a job row that cannot be read [SPEC 3.6 "Jobs" item 3 1.38, 14 1.38 Y8]', () => {
  it('on project open: the bad row fails as unreadable, the rest goes on', async () => {
    const x = fixture()
    insertRow(x, 'bad1', 'running', '{', JSON.stringify({ note: MARKER }))
    insertRow(x, 'good1', 'running', '{}', null, '2026-01-02T00:00:00.000Z')
    await expect(x.jobs.projectOpened(x.projectId)).resolves.toBeUndefined()
    expect(stored(x, 'bad1')).toEqual({ status: 'failed', errorKind: 'other' })
    expect(readJobErrorDetail(x.project.db, 'bad1')).toBe('unreadable_row')
    expect(x.row('good1')).toMatchObject({ status: 'failed', errorKind: 'other' })
    expect(readJobErrorDetail(x.project.db, 'good1')).toBe('interrupted')
    expect(x.jobEvents('good1').at(-1)?.status).toBe('failed')
    expect(x.jobEvents('bad1')).toHaveLength(0)
    const id = await x.start()
    await waitFor(done(x, id))
    expect(x.row(id)?.status).toBe('succeeded')
    expect(x.logText()).toContain('bad1')
    expect(x.logText()).not.toContain(MARKER)
    expect(x.jobEvents('bad1')).toHaveLength(0)
  })

  it('a queued bad row is found by the next enqueue and fails as unreadable', async () => {
    const x = fixture()
    insertRow(x, 'bad2', 'queued', '{', JSON.stringify({ note: MARKER }))
    const id = await x.start()
    await waitFor(done(x, id))
    expect(x.row(id)?.status).toBe('succeeded')
    expect(stored(x, 'bad2')).toEqual({ status: 'failed', errorKind: 'other' })
    expect(readJobErrorDetail(x.project.db, 'bad2')).toBe('unreadable_row')
    expect(x.jobEvents('bad2')).toHaveLength(0)
    expect(x.logText()).toContain('bad2')
    expect(x.logText()).not.toContain(MARKER)
  })
})
