import { describe, it, expect, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { makeFixture, data, type Fixture } from '../core-fixture'
import type { AppState } from '../../../src/shared/schemas/queries'

type Opened = { projectId: string; name: string; filePath: string }

const fixtures: Fixture[] = []
function fixture(): Fixture {
  const f = makeFixture()
  fixtures.push(f)
  return f
}
afterEach(() => {
  while (fixtures.length) fixtures.pop()?.cleanup()
})

async function createAndClose(f: Fixture, name: string): Promise<Opened> {
  const created = data<Opened>(await f.user('project.create', { name, location: f.projectsDir }))
  data(await f.user('project.close', { projectId: created.projectId }))
  return created
}

describe('project.open [FR-002, FR-003, R-06]', () => {
  it('reopens a project after the app restarts, with the same project ID', async () => {
    const f = fixture()
    const created = await createAndClose(f, 'Summer')
    f.restart()
    const opened = data<Opened>(await f.user('project.open', { filePath: created.filePath }))
    expect(opened).toEqual(created)
  })

  it('opens two projects at the same time, as tabs', async () => {
    const f = fixture()
    const a = await createAndClose(f, 'A')
    const b = await createAndClose(f, 'B')
    await f.user('project.open', { filePath: a.filePath })
    await f.user('project.open', { filePath: b.filePath })
    const state = data<AppState>(await f.core.query('app.getState', {}))
    expect(state.openProjects.map((p) => p.name)).toEqual(['A', 'B'])
  })

  it('returns the open project when the same file is opened again', async () => {
    const f = fixture()
    const a = await createAndClose(f, 'A')
    const first = data<Opened>(await f.user('project.open', { filePath: a.filePath }))
    const second = data<Opened>(await f.user('project.open', { filePath: a.filePath }))
    expect(second).toEqual(first)
    const state = data<AppState>(await f.core.query('app.getState', {}))
    expect(state.openProjects).toHaveLength(1)
  })

  it('moves an opened project to the top of the recent list without duplicating it', async () => {
    const f = fixture()
    const a = await createAndClose(f, 'A')
    await createAndClose(f, 'B')
    await f.user('project.open', { filePath: a.filePath })
    const state = data<AppState>(await f.core.query('app.getState', {}))
    expect(state.recentProjects.map((r) => r.name)).toEqual(['A', 'B'])
  })

  it('keeps at most 20 recent projects', async () => {
    const f = fixture()
    for (let i = 0; i < 22; i++) await createAndClose(f, `P${i}`)
    const state = data<AppState>(await f.core.query('app.getState', {}))
    expect(state.recentProjects).toHaveLength(20)
    expect(state.recentProjects[0]?.name).toBe('P21')
  })

  it('returns PROJECT_LOCKED when another copy of the app has it open', async () => {
    const f = fixture()
    const other = fixture()
    const created = data<Opened>(
      await f.user('project.create', { name: 'A', location: f.projectsDir }),
    )
    const result = await other.user('project.open', { filePath: created.filePath })
    expect(result).toMatchObject({ ok: false, error: { code: 'PROJECT_LOCKED' } })
  })

  it('returns NOT_FOUND for a missing file', async () => {
    const f = fixture()
    const result = await f.user('project.open', {
      filePath: path.join(f.projectsDir, 'gone.adman'),
    })
    expect(result).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } })
  })

  it('refuses a file made by a newer version with the SPEC 3.8 message', async () => {
    const f = fixture()
    const a = await createAndClose(f, 'A')
    const raw = new Database(a.filePath)
    raw.prepare("UPDATE project_meta SET value = '999' WHERE key = 'schema_version'").run()
    raw.close()
    const result = await f.user('project.open', { filePath: a.filePath })
    expect(result).toMatchObject({
      ok: false,
      error: {
        message:
          'This project was made with a newer version of the app. Download the latest version to open it.',
      },
    })
  })

  it('rejects a file without the .adman extension with INVALID_INPUT', async () => {
    const f = fixture()
    const other = path.join(f.projectsDir, 'notes.txt')
    fs.writeFileSync(other, 'hello')
    const result = await f.user('project.open', { filePath: other })
    expect(result).toMatchObject({ ok: false, error: { code: 'INVALID_INPUT' } })
  })

  it('is denied to agents [FR-201]', async () => {
    const f = fixture()
    const a = await createAndClose(f, 'A')
    expect(await f.agent('project.open', { filePath: a.filePath })).toMatchObject({
      ok: false,
      error: { code: 'AGENT_DENIED' },
    })
  })
})
