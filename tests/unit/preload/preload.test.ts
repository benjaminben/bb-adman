import { describe, it, expect, vi, beforeEach } from 'vitest'

const exposed: Record<string, unknown> = {}
const invoke = vi.fn(async (..._args: unknown[]) => ({ ok: true, data: null }))
type Listener = (event: unknown, msg: unknown) => void
const listeners = new Set<Listener>()
const deliver = (msg: unknown) => listeners.forEach((fn) => fn({}, msg))

vi.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld: (key: string, value: unknown) => {
      exposed[key] = value
    },
  },
  ipcRenderer: {
    invoke: (...args: unknown[]) => invoke(...args),
    on: (_channel: string, fn: Listener) => listeners.add(fn),
    removeListener: (_channel: string, fn: Listener) => listeners.delete(fn),
  },
}))

type Api = {
  command(name: string, input: unknown): Promise<unknown>
  query(name: string, input?: unknown): Promise<unknown>
  on(event: string, cb: (payload: unknown) => void): () => void
}

beforeEach(async () => {
  invoke.mockClear()
  await import('@/preload/index')
})

describe('preload bridge [SPEC 1.3, 4.1]', () => {
  it('exposes window.api with command, query and on, and nothing else', () => {
    expect(Object.keys(exposed)).toEqual(['api'])
    expect(Object.keys(exposed.api as object).sort()).toEqual(['command', 'on', 'query'])
  })

  it('sends only the command name and input; the window cannot choose an actor', async () => {
    const api = exposed.api as Api
    await api.command('project.create', { name: 'A' })
    expect(invoke).toHaveBeenCalledWith('adman:command', 'project.create', { name: 'A' })
  })

  it('delivers only the events the window subscribed to, and unsubscribes', () => {
    const api = exposed.api as Api
    const got: unknown[] = []
    const off = api.on('project.changed', (p) => got.push(p))
    deliver({ name: 'project.changed', payload: { projectId: 'p' } })
    deliver({ name: 'app.stateChanged', payload: {} })
    expect(got).toEqual([{ projectId: 'p' }])
    off()
    deliver({ name: 'project.changed', payload: { projectId: 'q' } })
    expect(got).toHaveLength(1)
  })
})
