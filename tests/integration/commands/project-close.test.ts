import { describe, it, expect, afterEach } from 'vitest'
import { makeFixture, data, type Fixture } from '../core-fixture'
import type { AppState } from '../../../src/shared/schemas/queries/app'

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

describe('project.close [FR-006]', () => {
  it('closes the project and removes it from the open list', async () => {
    const f = fixture()
    const p = data<Opened>(await f.user('project.create', { name: 'A', location: f.projectsDir }))
    expect((await f.user('project.close', { projectId: p.projectId })).ok).toBe(true)
    const state = data<AppState>(await f.core.query('app.getState', {}, { actor: 'user' }))
    expect(state.openProjects).toEqual([])
  })

  it('releases the lock so another copy of the app can open it', async () => {
    const f = fixture()
    const other = fixture()
    const p = data<Opened>(await f.user('project.create', { name: 'A', location: f.projectsDir }))
    await f.user('project.close', { projectId: p.projectId })
    expect((await other.user('project.open', { filePath: p.filePath })).ok).toBe(true)
  })

  it('drops the undo lists of the project', async () => {
    const f = fixture()
    const p = data<Opened>(await f.user('project.create', { name: 'A', location: f.projectsDir }))
    f.core.undo.record(p.projectId, 'variant:v1', { name: 'layer.update', input: {} })
    await f.user('project.close', { projectId: p.projectId })
    expect(f.core.undo.state(p.projectId, 'variant:v1')).toEqual({ canUndo: false, canRedo: false })
  })

  it('returns NOT_FOUND for a project that is not open', async () => {
    const f = fixture()
    expect(await f.user('project.close', { projectId: '01ABC' })).toMatchObject({
      ok: false,
      error: { code: 'NOT_FOUND' },
    })
  })

  it('is denied to agents', async () => {
    const f = fixture()
    const p = data<Opened>(await f.user('project.create', { name: 'A', location: f.projectsDir }))
    expect(await f.agent('project.close', { projectId: p.projectId })).toMatchObject({
      ok: false,
      error: { code: 'AGENT_DENIED' },
    })
  })
})
