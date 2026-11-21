import { describe, it, expect, afterEach } from 'vitest'
import { z } from 'zod'
import { defineCommand } from '@/main/commands/types'
import { registerIpc, IPC } from '@/main/ipc'
import { ok } from '@/shared/schemas/result'
import { makeMultiBus } from './multi-bus'

let fixture: ReturnType<typeof makeMultiBus> | undefined
afterEach(() => fixture?.cleanup())

type Handler = (event: unknown, ...args: unknown[]) => unknown

describe('internal commands [SPEC 4.2 notes, step 0 item 5]', () => {
  it('a window naming an internal command gets the unknown-command answer; the runner can send it', async () => {
    const internal = defineCommand({
      name: 'asset.addGenerated',
      internal: true,
      input: z.object({ projectId: z.string() }),
      projectId: (i) => i.projectId,
      run: () => ({ data: 'added' }),
    })
    expect(internal.internal).toBe(true)
    fixture = makeMultiBus({ count: 1, handlers: () => [internal] })
    const bus = fixture.bus
    const [p] = fixture.projects
    if (!p) throw new Error('project expected')

    const handlers = new Map<string, Handler>()
    const sent: string[] = []
    registerIpc(
      { handle: (channel: string, fn: Handler) => void handlers.set(channel, fn) },
      {
        execute: (name, input, opts) => {
          sent.push(name)
          return bus.execute(name, input, opts)
        },
        query: async () => ok(null),
        isInternal: (name) => name === 'asset.addGenerated',
        mayCall: () => true,
      },
    )
    const command = handlers.get(IPC.command)
    const input = { projectId: p.projectId }
    const fromWindow = await command?.({}, 'asset.addGenerated', input)
    const unknown = await command?.({}, 'asset.noSuchCommand', input)
    expect(fromWindow).toEqual({
      ok: false,
      error: { code: 'INVALID_INPUT', message: 'Unknown command: asset.addGenerated' },
    })
    expect(unknown).toEqual({
      ok: false,
      error: { code: 'INVALID_INPUT', message: 'Unknown command: asset.noSuchCommand' },
    })
    expect(sent).toEqual(['asset.noSuchCommand'])
    expect(await bus.execute('asset.addGenerated', input, { actor: 'user' })).toEqual(ok('added'))
  })
})
