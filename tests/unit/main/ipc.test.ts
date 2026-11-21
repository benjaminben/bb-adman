import { describe, it, expect } from 'vitest'
import { registerIpc, IPC } from '../../../src/main/ipc'
import { projectPathFromArgv } from '../../../src/main/open-file'
import { ok } from '../../../src/shared/schemas/result'

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
