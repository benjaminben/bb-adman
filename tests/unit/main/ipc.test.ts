import { describe, it, expect } from 'vitest'
import { registerIpc, IPC, fromMainFrame, eventSender } from '@/main/ipc'
import type { BusEvent } from '@/main/commands/bus'
import { projectPathFromArgv } from '@/main/open-file'
import { ok } from '@/shared/schemas/result'

type Handler = (event: unknown, ...args: unknown[]) => unknown

function fakeIpcMain() {
  const handlers = new Map<string, Handler>()
  return {
    handlers,
    handle(channel: string, fn: Handler) {
      handlers.set(channel, fn)
    },
  }
}

describe('IPC bridge to the bus [SPEC 4.1]', () => {
  it('always runs window commands as the user, whatever the window sends', async () => {
    const seen: unknown[] = []
    const ipc = fakeIpcMain()
    registerIpc(ipc, {
      execute: async (name, input, opts) => {
        seen.push({ name, input, opts })
        return ok(null)
      },
      query: async () => ok(null),
      isInternal: () => false,
      mayCall: () => true,
    })
    const command = ipc.handlers.get(IPC.command)
    await command?.({}, 'layer.update', { a: 1 }, { actor: 'agent' })
    expect(seen).toEqual([{ name: 'layer.update', input: { a: 1 }, opts: { actor: 'user' } }])
  })

  it('passes queries through by name', async () => {
    const ipc = fakeIpcMain()
    registerIpc(ipc, {
      execute: async () => ok(null),
      query: async (name, input) => ok({ name, input }),
      isInternal: () => false,
      mayCall: () => true,
    })
    const query = ipc.handlers.get(IPC.query)
    expect(await query?.({}, 'app.getState', {})).toEqual(ok({ name: 'app.getState', input: {} }))
  })

  it('always runs window queries as the user too [SPEC 4.1]', async () => {
    const seen: unknown[] = []
    const ipc = fakeIpcMain()
    registerIpc(ipc, {
      execute: async () => ok(null),
      query: async (name, input, opts) => {
        seen.push({ name, opts })
        return ok(null)
      },
      isInternal: () => false,
      mayCall: () => true,
    })
    await ipc.handlers.get(IPC.query)?.({}, 'app.getState', {}, { actor: 'agent' })
    expect(seen).toEqual([{ name: 'app.getState', opts: { actor: 'user' } }])
  })

  it('rejects a non-string command name with INVALID_INPUT', async () => {
    const ipc = fakeIpcMain()
    registerIpc(ipc, {
      execute: async () => ok(null),
      query: async () => ok(null),
      isInternal: () => false,
      mayCall: () => true,
    })
    expect(await ipc.handlers.get(IPC.command)?.({}, 42, {})).toMatchObject({
      ok: false,
      error: { code: 'INVALID_INPUT' },
    })
  })
})

describe('project path from the command line [R-06, SPEC 7.5]', () => {
  it('finds the .adman file the system passed when the file was double-clicked', () => {
    expect(projectPathFromArgv(['C:\\Adman\\Adman.exe', 'C:\\Users\\me\\Summer.adman'])).toBe(
      'C:\\Users\\me\\Summer.adman',
    )
    expect(projectPathFromArgv(['/x/Adman', '--flag', '/Users/me/A.ADMAN'])).toBe(
      '/Users/me/A.ADMAN',
    )
  })

  it('returns null when no project file was passed', () => {
    expect(projectPathFromArgv(['/x/Adman', '--inspect'])).toBeNull()
    expect(projectPathFromArgv(['/x/Adman', '/Users/me/notes.txt'])).toBeNull()
  })
})

// spec/security.md "Who may call" and review item LP-1.
describe('who may call [LP-1, P3-6]', () => {
  const mainFrame = { processId: 4, routingId: 1 }
  const appContents = { mainFrame }
  const otherContents = { mainFrame: { processId: 7, routingId: 1 } }
  const inner = { processId: 4, routingId: 9 }
  const elsewhere = { processId: 5, routingId: 1 }

  it.each([
    ['the app window main frame', { sender: appContents, senderFrame: mainFrame }, true],
    [
      'the same frame as a new object',
      { sender: appContents, senderFrame: { ...mainFrame } },
      true,
    ],
    ['a frame inside the page', { sender: appContents, senderFrame: inner }, false],
    ['a frame in another process', { sender: appContents, senderFrame: elsewhere }, false],
    ['a frame that is gone', { sender: appContents, senderFrame: null }, false],
    ['another window', { sender: otherContents, senderFrame: otherContents.mainFrame }, false],
  ])('fromMainFrame: %s gives %s', (_label, event, expected) => {
    expect(fromMainFrame(event, appContents)).toBe(expected)
  })

  it('fromMainFrame refuses every sender when there is no app window', () => {
    expect(fromMainFrame({ sender: appContents, senderFrame: mainFrame }, null)).toBe(false)
  })

  it.each([IPC.command, IPC.query])(
    'refuses a call on %s from a sender mayCall rejects, before execute or query runs',
    async (channel) => {
      const ran: string[] = []
      const ipc = fakeIpcMain()
      registerIpc(ipc, {
        execute: async () => {
          ran.push('execute')
          return ok(null)
        },
        query: async () => {
          ran.push('query')
          return ok(null)
        },
        isInternal: () => {
          ran.push('isInternal')
          return false
        },
        mayCall: (event) => event === 'app',
      })
      const reply = await ipc.handlers.get(channel)?.('render', 'project.list', {})
      expect(reply).toEqual({
        ok: false,
        error: { code: 'INVALID_INPUT', message: 'Unknown request.' },
      })
      expect(ran).toEqual([])
      await ipc.handlers.get(channel)?.('app', 'project.list', {})
      expect(ran.length).toBeGreaterThan(0)
    },
  )

  it('sends an event to the app window only, and hands it to onEvent', () => {
    const sent: unknown[] = []
    const seen: unknown[] = []
    const app = { send: (channel: string, event: unknown) => sent.push({ channel, event }) }
    const send = eventSender(
      () => app,
      (event) => seen.push(event),
    )
    send(EVENT)
    expect(sent).toEqual([{ channel: IPC.event, event: EVENT }])
    expect(seen).toEqual([EVENT])
  })

  it('still hands an event to onEvent when there is no app window', () => {
    const seen: unknown[] = []
    const send = eventSender(
      () => null,
      (event) => seen.push(event),
    )
    send(EVENT)
    expect(seen).toEqual([EVENT])
  })
})

const EVENT = { name: 'project.changed', payload: {} } as unknown as BusEvent
