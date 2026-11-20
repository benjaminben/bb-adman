// Connects window.api to the bus and the queries. Every window command runs with
// actor 'user'; the window cannot choose (SPEC 4.1).
import { IPC_CHANNELS } from '../shared/schemas/api'
import { fail, type Result } from '../shared/schemas/result'
import type { ExecuteOptions } from './commands/bus'

export const IPC = IPC_CHANNELS

type IpcMainLike = {
  handle(channel: string, fn: (event: unknown, ...args: unknown[]) => unknown): void
}

export type IpcTargets = {
  execute(name: string, input: unknown, opts: ExecuteOptions): Promise<Result<unknown>>
  query(name: string, input: unknown): Promise<Result<unknown>>
}

const badName = () => fail({ code: 'INVALID_INPUT', message: 'Unknown request.' })

export function registerIpc(ipcMain: IpcMainLike, targets: IpcTargets): void {
  ipcMain.handle(IPC.command, async (_event, name, input) => {
    if (typeof name !== 'string') return badName()
    return targets.execute(name, input, { actor: 'user' })
  })
  ipcMain.handle(IPC.query, async (_event, name, input) => {
    if (typeof name !== 'string') return badName()
    return targets.query(name, input ?? {})
  })
}
