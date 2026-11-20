import type { Result } from './result'
import type { EventMap, EventName } from './events'

// window.api, the window's only route to the main process (SPEC 1.3, 4.1).
export type AdmanApi = {
  command(name: string, input: unknown): Promise<Result<unknown>>
  query(name: string, input?: unknown): Promise<Result<unknown>>
  on<E extends EventName>(event: E, listener: (payload: EventMap[E]) => void): () => void
}

export const IPC_CHANNELS = {
  command: 'adman:command',
  query: 'adman:query',
  event: 'adman:event',
} as const
