// Connects window.api to the bus and the queries. Every window command runs with
// actor 'user', and so does every window query; the window cannot choose (SPEC 4.1).
import { IPC_CHANNELS } from '../shared/schemas/api'
import { fail, type Result } from '../shared/schemas/result'
import { unknownCommandMessage, type ExecuteOptions } from './commands/bus'
import type { QueryOptions } from './queries/queries'

export const IPC = IPC_CHANNELS

type IpcMainLike<E> = {
  handle(channel: string, fn: (event: E, ...args: unknown[]) => unknown): void
}

// A query also gets the IPC event, so a picker can be modal to the window that asked
// (SPEC 4.3). The event type stays generic: this file does not import Electron.
export type IpcTargets<E = unknown> = {
  execute(name: string, input: unknown, opts: ExecuteOptions): Promise<Result<unknown>>
  query(name: string, input: unknown, opts: QueryOptions, event: E): Promise<Result<unknown>>
  // Internal commands are sent by the job runner only (SPEC 4.2 notes).
  isInternal?: (name: string) => boolean
}

const badName = () => fail({ code: 'INVALID_INPUT', message: 'Unknown request.' })

export function registerIpc<E>(ipcMain: IpcMainLike<E>, targets: IpcTargets<E>): void {
  ipcMain.handle(IPC.command, async (_event, name, input) => {
    if (typeof name !== 'string') return badName()
    if (targets.isInternal?.(name)) {
      return fail({ code: 'INVALID_INPUT', message: unknownCommandMessage(name) })
    }
    return targets.execute(name, input, { actor: 'user' })
  })
  ipcMain.handle(IPC.query, async (event, name, input) => {
    if (typeof name !== 'string') return badName()
    return targets.query(name, input ?? {}, { actor: 'user' }, event)
  })
}
