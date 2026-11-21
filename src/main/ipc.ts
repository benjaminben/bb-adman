// Connects window.api to the bus and the queries. Every window command runs with
// actor 'user', and so does every window query; the window cannot choose (SPEC 4.1).
// Only the app window's main frame may call (spec/security.md "Who may call", LP-1).
import { IPC_CHANNELS } from '@/shared/schemas/api'
import { fail, type Result } from '@/shared/schemas/result'
import { unknownCommandMessage, type BusEvent, type ExecuteOptions } from './commands/bus'
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
  isInternal: (name: string) => boolean
  // Checked before anything else; a sender it refuses gets "Unknown request." and nothing runs.
  mayCall: (event: E) => boolean
}

// The parts of Electron's frame and IPC event that the sender checks read.
type FrameLike = { processId: number; routingId: number }
export type SenderEvent = { sender: unknown; senderFrame: FrameLike | null }

// True only when the event comes from these web contents and from their top frame.
export function fromMainFrame(
  event: SenderEvent,
  contents: { mainFrame: FrameLike } | null,
): boolean {
  const frame = event.senderFrame
  if (contents === null || frame === null || event.sender !== contents) return false
  const main = contents.mainFrame
  return frame.processId === main.processId && frame.routingId === main.routingId
}

// Every event goes to the app window only, and to the main process listener.
export function eventSender(
  appWindow: () => { send(channel: string, event: BusEvent): void } | null,
  onEvent: (event: BusEvent) => void,
): (event: BusEvent) => void {
  return (event) => {
    appWindow()?.send(IPC.event, event)
    onEvent(event)
  }
}

const badName = () => fail({ code: 'INVALID_INPUT', message: 'Unknown request.' })

export function registerIpc<E>(ipcMain: IpcMainLike<E>, targets: IpcTargets<E>): void {
  ipcMain.handle(IPC.command, async (event, name, input) => {
    if (!targets.mayCall(event) || typeof name !== 'string') return badName()
    if (targets.isInternal(name)) {
      return fail({ code: 'INVALID_INPUT', message: unknownCommandMessage(name) })
    }
    return targets.execute(name, input, { actor: 'user' })
  })
  ipcMain.handle(IPC.query, async (event, name, input) => {
    if (!targets.mayCall(event) || typeof name !== 'string') return badName()
    return targets.query(name, input ?? {}, { actor: 'user' }, event)
  })
}
