import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, afterEach } from 'vitest'
import { registerIpc, IPC } from '@/main/ipc'
import { makeDevFixture, sourceFile, type DevFixture } from './dev-fixture'

let f: DevFixture
afterEach(() => f.cleanup())

type Handler = (event: unknown, ...args: unknown[]) => unknown

// The window's path: the IPC bridge in front of the real core.
function windowCommand(fixture: DevFixture) {
  const handlers = new Map<string, Handler>()
  registerIpc(
    { handle: (channel, fn) => void handlers.set(channel, fn) },
    {
      execute: (name, input, opts) => fixture.core.bus.execute(name, input, opts),
      query: (name, input, opts) => fixture.core.query(name, input, opts),
      isInternal: fixture.core.isInternal,
    },
  )
  const command = handlers.get(IPC.command)
  if (!command) throw new Error('no command channel')
  return (name: string, input: unknown, ...extra: unknown[]) => command({}, name, input, ...extra)
}

describe('dev.storage through the IPC bridge [SPEC 4.1, 4.2 dev.storage]', () => {
  it('uploads, lists and removes from the window', async () => {
    f = makeDevFixture(true)
    const send = windowCommand(f)
    const filePath = sourceFile(f.outside, 'note.txt')
    expect(await send('dev.storage', { storage: 'local', action: 'write', filePath })).toEqual({
      ok: true,
      data: { name: 'note.txt', size: 9 },
    })
    expect(await send('dev.storage', { storage: 'local', action: 'list' })).toEqual({
      ok: true,
      data: { names: ['note.txt'] },
    })
    expect(await send('dev.storage', { storage: 'local', action: 'remove' })).toEqual({
      ok: true,
      data: { removed: 1 },
    })
    expect(fs.readdirSync(f.handTestDir)).toEqual([])
  })

  it('runs as the user even when the window claims to be an agent', async () => {
    f = makeDevFixture(true)
    const send = windowCommand(f)
    const result = await send(
      'dev.storage',
      { storage: 'local', action: 'list' },
      { actor: 'agent' },
    )
    expect(result).toEqual({ ok: true, data: { names: [] } })
  })

  it('is unknown to the window when the hand-test tools are off', async () => {
    f = makeDevFixture(false)
    const send = windowCommand(f)
    const filePath = sourceFile(f.outside)
    const result = await send('dev.storage', { storage: 'local', action: 'write', filePath })
    expect(result).toMatchObject({ ok: false, error: { code: 'INVALID_INPUT' } })
    expect(fs.existsSync(path.join(f.userData, 'adman-hand-test'))).toBe(false)
  })
})
