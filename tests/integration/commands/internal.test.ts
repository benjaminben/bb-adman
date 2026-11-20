import { describe, it, expect, afterEach } from 'vitest'
import { defineCommand } from '../../../src/main/commands/types'
import { z } from 'zod'
import { makeMultiBus, refusableSet, TEST_SCOPE } from './multi-bus'

let fixture: ReturnType<typeof makeMultiBus> | undefined
afterEach(() => fixture?.cleanup())

const INTERNAL_MESSAGE = 'Something went wrong. The details are in the activity log.'
const user = { actor: 'user' as const }

const appScopeThrower = defineCommand({
  name: 'settings.update',
  input: z.object({}),
  run() {
    throw new TypeError('cannot read /Users/someone/private.json')
  },
})

describe('INTERNAL: the bus never throws [SPEC 3.6, 4.1, 10.1]', () => {
  it('turns an unknown error from a handler into INTERNAL with the fixed message, logs it in full and changes nothing', async () => {
    const f = (fixture = makeMultiBus({ count: 1, handlers: (ctl) => [refusableSet(ctl)] }))
    const [p] = f.projects
    if (!p) throw new Error('project expected')
    f.ctl.throwUnknown = true

    const result = await f.bus.execute('layer.update', { projectId: p.projectId, value: 'x' }, user)

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'INTERNAL',
        message: INTERNAL_MESSAGE,
        details: { commandId: expect.stringMatching(/^[0-9A-Z]{26}$/) },
      },
    })
    expect(JSON.stringify(result)).not.toContain('boom')
    expect(JSON.stringify(result)).not.toContain('/Users/someone')
    expect(p.value()).toBeNull()
    expect(f.events).toEqual([])
    expect(f.undo.state(p.projectId, TEST_SCOPE).canUndo).toBe(false)

    const line = f.logLines().at(-1)
    expect(line).toMatchObject({
      level: 'error',
      event: 'command',
      name: 'layer.update',
      ok: false,
      errorKind: 'INTERNAL',
    })
    const context = line?.context as {
      commandId: string
      error: { name: string; message: string; stack: string }
    }
    if (result.ok) throw new Error('expected a failure')
    expect(context.commandId).toBe(result.error.details?.commandId)
    expect(context.error.name).toBe('Error')
    expect(context.error.message).toBe('boom at /Users/someone/secret/path.adman')
    expect(context.error.stack).toContain('boom')
  })

  it('turns an unknown error from an app-scope handler into INTERNAL', async () => {
    const f = (fixture = makeMultiBus({ count: 1, handlers: () => [appScopeThrower] }))
    const result = await f.bus.execute('settings.update', {}, user)
    expect(result).toMatchObject({
      ok: false,
      error: { code: 'INTERNAL', message: INTERNAL_MESSAGE },
    })
    expect(JSON.stringify(result)).not.toContain('/Users/someone')
    expect(f.logLines().at(-1)).toMatchObject({ level: 'error', errorKind: 'INTERNAL' })
  })

  it('keeps the undo entry in place when its replay throws an unknown error [SPEC 4.2]', async () => {
    const f = (fixture = makeMultiBus({ count: 1, handlers: (ctl) => [refusableSet(ctl)] }))
    const [p] = f.projects
    if (!p) throw new Error('project expected')
    await f.bus.execute('layer.update', { projectId: p.projectId, value: 'a' }, user)
    await f.bus.execute('layer.update', { projectId: p.projectId, value: 'b' }, user)
    f.ctl.throwUnknown = true

    const result = await f.bus.execute(
      'history.undo',
      { projectId: p.projectId, scope: TEST_SCOPE },
      user,
    )

    expect(result).toMatchObject({ ok: false, error: { code: 'INTERNAL' } })
    expect(p.value()).toBe('b')
    expect(f.undo.state(p.projectId, TEST_SCOPE)).toEqual({ canUndo: true, canRedo: false })
    f.ctl.throwUnknown = false
    await f.bus.execute('history.undo', { projectId: p.projectId, scope: TEST_SCOPE }, user)
    expect(p.value()).toBe('a')
  })
})
