// P10-2 (spec/phases/phase-10.md, "Design additions", A-235): subject.list gives the subjects
// of an open project by ID, each with the IDs of the asset rows attached to it, by ID. Both
// actors may read it.
import { describe, it, expect, afterEach } from 'vitest'
import { data, makeFixture, type Fixture } from '../core-fixture'
import type { SubjectList } from '@/shared/schemas/queries/subject'

let f: Fixture | undefined
afterEach(() => {
  f?.cleanup()
  f = undefined
})

async function setUp() {
  f = makeFixture()
  const { projectId } = data<{ projectId: string }>(
    await f.user('project.create', { name: 'Subjects', location: f.projectsDir }),
  )
  const db = f.core.projects.requireOpen(projectId).db
  const subject = db.prepare(
    `INSERT INTO subject (id, name, description, created_at)
     VALUES (?, ?, ?, '2026-01-01T00:00:00Z')`,
  )
  subject.run('s2', 'Bottle', 'A green bottle')
  subject.run('s1', 'Can', 'A red can')
  subject.run('s3', 'Box', '')
  const asset = db.prepare(
    `INSERT INTO asset (id, library, kind, origin, storage, subject_id, display_name,
      abs_path, rel_path, mime, byte_size, mtime_ms, content_hash, created_at)
     VALUES (?, 'asset', 'image', 'imported', 'managed', ?, 'Picture', '/made-up/abs.png',
      'assets/made-up.png', 'image/png', 1, 1, 'h', '2026-01-01T00:00:00Z')`,
  )
  asset.run('a3', 's1')
  asset.run('a1', 's1')
  asset.run('a2', 's2')
  asset.run('a4', null)
  return { fx: f, projectId, db }
}

const EXPECTED: SubjectList = [
  { id: 's1', name: 'Can', description: 'A red can', assetIds: ['a1', 'a3'] },
  { id: 's2', name: 'Bottle', description: 'A green bottle', assetIds: ['a2'] },
  { id: 's3', name: 'Box', description: '', assetIds: [] },
]

describe('subject.list [P10-2, A-235]', () => {
  it.each(['user', 'agent'] as const)(
    'gives the subjects by ID with their asset IDs by ID, for the %s',
    async (actor) => {
      const { fx, projectId } = await setUp()
      const result = await fx.core.query('subject.list', { projectId }, { actor })
      expect(result).toEqual({ ok: true, data: EXPECTED })
    },
  )

  it('answers NOT_FOUND for a project that is not open', async () => {
    const { fx } = await setUp()
    const result = await fx.core.query(
      'subject.list',
      { projectId: 'made-up-project' },
      { actor: 'agent' },
    )
    expect(result).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } })
  })

  it('answers INVALID_INPUT for input that is not a project ID', async () => {
    const { fx } = await setUp()
    const result = await fx.core.query('subject.list', { projectId: 7 }, { actor: 'agent' })
    expect(result).toMatchObject({ ok: false, error: { code: 'INVALID_INPUT' } })
  })

  it('leaves a damaged subject row out and logs it by table and key', async () => {
    const { fx, projectId, db } = await setUp()
    db.prepare(`UPDATE subject SET name = X'00ff' WHERE id = 's2'`).run()
    const result = await fx.core.query('subject.list', { projectId }, { actor: 'agent' })
    expect(result).toEqual({ ok: true, data: [EXPECTED[0], EXPECTED[2]] })
    const logs = fx.readLogs()
    expect(logs).toContain('A stored row could not be read and was left out.')
    expect(logs).toContain('"table":"subject"')
  })
})
