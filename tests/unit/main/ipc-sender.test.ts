import { describe, it, expect } from 'vitest'
import { registerIpc, IPC } from '@/main/ipc'
import { ok } from '@/shared/schemas/result'

type Handler = (event: { sender: string }, ...args: unknown[]) => unknown

describe('IPC bridge passes the asking window to queries [SPEC 4.3, S2-04]', () => {
  it('gives the query target the event of the window that asked', async () => {
    const handlers = new Map<string, Handler>()
    const seen: unknown[] = []
    registerIpc(
      { handle: (channel: string, fn: Handler) => void handlers.set(channel, fn) },
      {
        execute: async () => ok(null),
        query: async (name, _input, opts, event) => {
          seen.push({ name, opts, event })
          return ok(null)
        },
        isInternal: () => false,
        mayCall: () => true,
      },
    )
    await handlers.get(IPC.query)?.({ sender: 'window-2' }, 'dialog.pickFolder', {})
    expect(seen).toEqual([
      { name: 'dialog.pickFolder', opts: { actor: 'user' }, event: { sender: 'window-2' } },
    ])
  })
})
