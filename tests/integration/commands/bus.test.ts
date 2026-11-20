import { describe, it, expect, afterEach } from 'vitest'
import { makeBusFixture, setValueHandler } from './test-bus'

let fixture: ReturnType<typeof makeBusFixture> | undefined
afterEach(() => fixture?.cleanup())

function setup(...args: Parameters<typeof makeBusFixture>) {
  fixture = makeBusFixture(...args)
  return fixture
}

describe('command bus: validation and policy [SPEC 3.6, 4.1, 5.2]', () => {
  it('rejects input that fails the schema with INVALID_INPUT and runs nothing', async () => {
    const f = setup([setValueHandler()])
    const result = await f.bus.execute(
      'layer.update',
      { projectId: f.projectId },
      { actor: 'user' },
    )
    expect(result).toMatchObject({ ok: false, error: { code: 'INVALID_INPUT' } })
    expect(f.value()).toBeNull()
  })

  it('rejects an unknown command with INVALID_INPUT', async () => {
    const f = setup([])
    const result = await f.bus.execute('nope.nothing', {}, { actor: 'user' })
    expect(result).toMatchObject({ ok: false, error: { code: 'INVALID_INPUT' } })
  })

  it('returns NOT_FOUND when the project is not open', async () => {
    const f = setup([setValueHandler()])
    const result = await f.bus.execute(
      'layer.update',
      { projectId: 'other', value: 'a' },
      { actor: 'user' },
    )
    expect(result).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } })
  })

  it('refuses an agent with AGENT_DENIED when the policy is deny, before the handler runs', async () => {
    const f = setup([setValueHandler('settings.update')])
    const result = await f.bus.execute(
      'settings.update',
      { projectId: f.projectId, value: 'a' },
      { actor: 'agent' },
    )
    expect(result).toMatchObject({
      ok: false,
      error: { code: 'AGENT_DENIED', message: expect.stringMatching(/^Agents cannot/) },
    })
    expect(f.value()).toBeNull()
  })

  it('lets the user run a command that agents are denied', async () => {
    const f = setup([setValueHandler('settings.update')])
    const result = await f.bus.execute(
      'settings.update',
      { projectId: f.projectId, value: 'a' },
      { actor: 'user' },
    )
    expect(result).toEqual({ ok: true, data: { value: 'a' } })
  })

  it('runs an allowed command for an agent', async () => {
    const f = setup([setValueHandler('layer.update')])
    const result = await f.bus.execute(
      'layer.update',
      { projectId: f.projectId, value: 'a' },
      { actor: 'agent' },
    )
    expect(result.ok).toBe(true)
    expect(f.value()).toBe('a')
  })

  it('asks the user for an ask command, and returns AGENT_REFUSED on refusal [FR-197]', async () => {
    const asked: string[] = []
    const f = setup([setValueHandler('variant.delete')], async (req) => {
      asked.push(req.command)
      return false
    })
    const result = await f.bus.execute(
      'variant.delete',
      { projectId: f.projectId, value: 'a' },
      { actor: 'agent' },
    )
    expect(asked).toEqual(['variant.delete'])
    expect(result).toMatchObject({ ok: false, error: { code: 'AGENT_REFUSED' } })
    expect(f.value()).toBeNull()
  })

  it('runs an ask command for an agent once the user allows it', async () => {
    const f = setup([setValueHandler('variant.delete')], async () => true)
    const result = await f.bus.execute(
      'variant.delete',
      { projectId: f.projectId, value: 'a' },
      { actor: 'agent' },
    )
    expect(result.ok).toBe(true)
  })
})

describe('command bus: transactions, events, undo and log [SPEC 3.6]', () => {
  it('rolls back every write when the handler fails, and emits and records nothing', async () => {
    const f = setup([setValueHandler()])
    const result = await f.bus.execute(
      'layer.update',
      { projectId: f.projectId, value: 'a', failAfterWrite: true },
      { actor: 'user' },
    )
    expect(result).toMatchObject({ ok: false, error: { code: 'RULE_VIOLATION' } })
    expect(f.value()).toBeNull()
    expect(f.events).toEqual([])
    expect(f.undo.state(f.projectId, 'campaign:c1').canUndo).toBe(false)
  })

  it('emits project.changed with the changed rows and the actor', async () => {
    const f = setup([setValueHandler()])
    await f.bus.execute('layer.update', { projectId: f.projectId, value: 'a' }, { actor: 'agent' })
    expect(f.events).toEqual([
      {
        name: 'project.changed',
        payload: {
          projectId: f.projectId,
          changed: { project_meta: [{ key: 'test_value', value: 'a' }] },
          removed: {},
          actor: 'agent',
        },
      },
    ])
  })

  it('rejects a malformed undo scope with INVALID_INPUT', async () => {
    const f = setup([setValueHandler()])
    expect(
      await f.bus.execute('history.undo', { scope: 'layer:x' }, { actor: 'user' }),
    ).toMatchObject({ ok: false, error: { code: 'INVALID_INPUT' } })
  })

  it('logs every command with its actor and a command ID, and never its input values [FR-200, FR-198]', async () => {
    const f = setup([setValueHandler()])
    await f.bus.execute(
      'layer.update',
      { projectId: f.projectId, value: 'sekret-value-123' },
      { actor: 'agent', agentClient: 'claude-code' },
    )
    await f.bus.execute('layer.update', { projectId: f.projectId }, { actor: 'user' })
    const [first, second] = f.logLines()
    expect(first).toMatchObject({
      event: 'command',
      name: 'layer.update',
      actor: 'agent',
      agentClient: 'claude-code',
      projectId: f.projectId,
      ok: true,
    })
    expect((first?.context as { commandId: string }).commandId).toMatch(/^[0-9A-Z]{26}$/)
    expect(second).toMatchObject({ actor: 'user', ok: false, errorKind: 'INVALID_INPUT' })
    expect(f.logText()).not.toContain('sekret-value-123')
  })
})
