import path from 'node:path'
import { describe, it, expect, afterEach } from 'vitest'
import { makeFixture, data, type Fixture } from '../core-fixture'

let f: Fixture
afterEach(() => f.cleanup())

describe('no error from a Phase 1 command holds a file path in details [SPEC 4.1, 1.7]', () => {
  it('project.create file_exists: the whole error, details only the reason', async () => {
    f = makeFixture()
    data(await f.user('project.create', { name: 'A', location: f.projectsDir }))
    const result = await f.user('project.create', { name: 'A', location: f.projectsDir })
    expect(result).toEqual({
      ok: false,
      error: {
        code: 'RULE_VIOLATION',
        message: 'A file with this name already exists in that folder.',
        details: { reason: 'file_exists' },
      },
    })
    expect(JSON.stringify(result)).not.toContain(f.root)
  })

  it('project.open NOT_FOUND for a path with no file: the whole error, no details', async () => {
    f = makeFixture()
    const result = await f.user('project.open', {
      filePath: path.join(f.projectsDir, 'gone.adman'),
    })
    expect(result).toEqual({
      ok: false,
      error: { code: 'NOT_FOUND', message: 'The project file could not be found.' },
    })
    expect(JSON.stringify(result)).not.toContain(f.root)
  })

  it('project_not_open keeps details.projectId', async () => {
    f = makeFixture()
    expect(await f.user('project.close', { projectId: 'gone' })).toMatchObject({
      error: { details: { projectId: 'gone', reason: 'project_not_open' } },
    })
  })
})
