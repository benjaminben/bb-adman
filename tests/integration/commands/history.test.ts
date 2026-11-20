import { describe, it, expect, afterEach } from 'vitest'
import { makeMultiBus, refusableSet, TEST_SCOPE } from './multi-bus'

let fixture: ReturnType<typeof makeMultiBus> | undefined
afterEach(() => fixture?.cleanup())

function setup(count = 1) {
  fixture = makeMultiBus({ count, handlers: (ctl) => [refusableSet(ctl)] })
  return fixture
}

const user = { actor: 'user' as const }

describe('history.undo and history.redo name their project [SPEC 4.1, 4.2]', () => {
  it('undoes and redoes in the named project only, when two projects hold the same scope', async () => {
    const f = setup(2)
    const [a, b] = f.projects
    if (!a || !b) throw new Error('two projects expected')
    await f.bus.execute('layer.update', { projectId: a.projectId, value: 'a1' }, user)
    await f.bus.execute('layer.update', { projectId: b.projectId, value: 'b1' }, user)

    const undone = await f.bus.execute(
      'history.undo',
      { projectId: b.projectId, scope: TEST_SCOPE },
      user,
    )
    expect(undone.ok).toBe(true)
    expect(b.value()).toBe('')
    expect(a.value()).toBe('a1')
    expect(f.undo.state(a.projectId, TEST_SCOPE)).toEqual({ canUndo: true, canRedo: false })
    expect(f.undo.state(b.projectId, TEST_SCOPE)).toEqual({ canUndo: false, canRedo: true })

    const redone = await f.bus.execute(
      'history.redo',
      { projectId: b.projectId, scope: TEST_SCOPE },
      user,
    )
    expect(redone.ok).toBe(true)
    expect(b.value()).toBe('b1')
    expect(f.undo.state(b.projectId, TEST_SCOPE)).toEqual({ canUndo: true, canRedo: false })
  })

  it('does not undo in another project when the named project has an empty list', async () => {
    const f = setup(2)
    const [a, b] = f.projects
    if (!a || !b) throw new Error('two projects expected')
    await f.bus.execute('layer.update', { projectId: a.projectId, value: 'a1' }, user)
    const result = await f.bus.execute(
      'history.undo',
      { projectId: b.projectId, scope: TEST_SCOPE },
      user,
    )
    expect(result).toMatchObject({ ok: false, error: { code: 'RULE_VIOLATION' } })
    expect(a.value()).toBe('a1')
    expect(f.undo.state(a.projectId, TEST_SCOPE).canUndo).toBe(true)
  })

  it('rejects history.undo and history.redo without a projectId as INVALID_INPUT', async () => {
    const f = setup()
    for (const name of ['history.undo', 'history.redo']) {
      expect(await f.bus.execute(name, { scope: TEST_SCOPE }, user)).toMatchObject({
        ok: false,
        error: { code: 'INVALID_INPUT' },
      })
    }
  })

  it('returns NOT_FOUND when the named project is not open', async () => {
    const f = setup()
    for (const name of ['history.undo', 'history.redo']) {
      expect(
        await f.bus.execute(name, { projectId: 'not-open', scope: TEST_SCOPE }, user),
      ).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } })
    }
  })

  it('refuses history.undo and history.redo for an agent [SPEC 4.2]', async () => {
    const f = setup()
    const [p] = f.projects
    for (const name of ['history.undo', 'history.redo']) {
      expect(
        await f.bus.execute(
          name,
          { projectId: p?.projectId, scope: TEST_SCOPE },
          { actor: 'agent' },
        ),
      ).toMatchObject({ ok: false, error: { code: 'AGENT_DENIED' } })
    }
  })
})
