import { describe, it, expect, afterEach } from 'vitest'
import { makeFixture, data, type Fixture } from '../core-fixture'

let f: Fixture
afterEach(() => f.cleanup())

type State = { canUndo: boolean; canRedo: boolean }
const user = { actor: 'user' as const }

async function createProject(name: string): Promise<string> {
  return data<{ projectId: string }>(
    await f.user('project.create', { name, location: f.projectsDir }),
  ).projectId
}

describe('history.state takes projectId and scope [SPEC 4.1, 4.3]', () => {
  it('reports the named project only, when two projects hold the same scope', async () => {
    f = makeFixture()
    const a = await createProject('A')
    const b = await createProject('B')
    f.core.undo.record(a, 'variant:abc234', { name: 'layer.update', input: {} })
    const stateOf = async (projectId: string) =>
      data<State>(await f.core.query('history.state', { projectId, scope: 'variant:abc234' }, user))
    expect(await stateOf(a)).toEqual({ canUndo: true, canRedo: false })
    expect(await stateOf(b)).toEqual({ canUndo: false, canRedo: false })
  })

  it('rejects a query without a projectId as INVALID_INPUT', async () => {
    f = makeFixture()
    expect(await f.core.query('history.state', { scope: 'variant:abc234' }, user)).toMatchObject({
      ok: false,
      error: { code: 'INVALID_INPUT' },
    })
  })

  it('rejects a malformed scope as INVALID_INPUT', async () => {
    f = makeFixture()
    const a = await createProject('A')
    expect(
      await f.core.query('history.state', { projectId: a, scope: 'nope' }, user),
    ).toMatchObject({ ok: false, error: { code: 'INVALID_INPUT' } })
  })

  it('returns NOT_FOUND when the named project is not open', async () => {
    f = makeFixture()
    expect(
      await f.core.query('history.state', { projectId: 'nope', scope: 'variant:abc234' }, user),
    ).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } })
  })
})
