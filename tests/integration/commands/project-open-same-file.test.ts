import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, afterEach } from 'vitest'
import { makeFixture, data, type Fixture } from '../core-fixture'

type Opened = { projectId: string; name: string; filePath: string }

let f: Fixture
afterEach(() => f.cleanup())

async function create(name: string): Promise<Opened> {
  return data<Opened>(await f.user('project.create', { name, location: f.projectsDir }))
}

const caseInsensitive = (file: string) =>
  fs.existsSync(file.toUpperCase().replace('.ADMAN', '.adman'))

describe('project.open compares real paths [SPEC 4.2 notes]', () => {
  it('returns the open project when the same file is named through a symbolic link', async () => {
    f = makeFixture()
    const a = await create('Alpha')
    const linkDir = path.join(f.root, 'link')
    fs.symlinkSync(f.projectsDir, linkDir, 'junction')
    const result = await f.user('project.open', { filePath: path.join(linkDir, 'Alpha.adman') })
    expect(result).toMatchObject({ ok: true, data: { projectId: a.projectId } })
    expect(f.core.projects.all()).toHaveLength(1)
  })

  it('returns the open project when the path differs only in letter case, where the file system ignores case', async (ctx) => {
    f = makeFixture()
    const a = await create('Alpha')
    const other = path.join(path.dirname(a.filePath), 'ALPHA.adman')
    if (!caseInsensitive(a.filePath)) ctx.skip()
    const result = await f.user('project.open', { filePath: other })
    expect(result).toMatchObject({ ok: true, data: { projectId: a.projectId } })
    expect(f.core.projects.all()).toHaveLength(1)
  })
})

describe('project.open refuses a copy of an open project [SPEC 4.1, 4.2 notes]', () => {
  it('refuses with duplicate_project, keeps the first project open and closes the copy', async () => {
    f = makeFixture()
    const a = await create('Alpha')
    data(await f.user('project.close', { projectId: a.projectId }))
    const copy = path.join(f.projectsDir, 'Alpha copy.adman')
    fs.copyFileSync(a.filePath, copy)
    data(await f.user('project.open', { filePath: a.filePath }))

    const result = await f.user('project.open', { filePath: copy })

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'RULE_VIOLATION',
        message:
          'A copy of this project is already open. Close it first. To work on both, make the copy with Package project.',
        details: { reason: 'duplicate_project' },
      },
    })
    expect(f.core.projects.all().map((h) => h.filePath)).toEqual([a.filePath])
    expect(f.core.projects.get(a.projectId)?.db.open).toBe(true)

    // The copy's handle was closed, so its lock is free once the first project closes.
    data(await f.user('project.close', { projectId: a.projectId }))
    expect(await f.user('project.open', { filePath: copy })).toMatchObject({
      ok: true,
      data: { projectId: a.projectId },
    })
  })
})
