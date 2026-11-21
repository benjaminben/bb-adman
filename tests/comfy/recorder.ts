// SPEC 6.10.12 [REQ: FR-289]: each ComfyUI test wraps the client in this recorder and ends by
// asserting the calls made were only the ones it meant to make. It also keeps each call that
// failed, with its argument, so the check case can say which call ended the check (1.45 B-1).
// Arguments recorded are the app's own values (a folder or class name from a shipped workflow,
// or an ID this test made), never the server's text.
import type { ComfyClient } from '../../src/main/providers/comfyui/client'

export type CallName = Exclude<keyof ComfyClient, 'adopt'>
export type Call = { name: CallName; arg?: string }
export type FailedCall = Call & { error: unknown }

const ARG_OF: Partial<Record<CallName, (a: unknown) => string>> = {
  modelFiles: String,
  nodeInfo: String,
  submit: String,
  history: String,
  jobState: String,
  removeFromQueue: String,
  interrupt: String,
}

export function recordCalls(inner: ComfyClient) {
  const calls: Call[] = []
  const failures: FailedCall[] = []

  const wrap =
    <A extends unknown[], R>(name: CallName, fn: (...args: A) => Promise<R>) =>
    async (...args: A): Promise<R> => {
      const toArg = ARG_OF[name]
      const call: Call = toArg ? { name, arg: toArg(args[0]) } : { name }
      calls.push(call)
      try {
        return await fn(...args)
      } catch (error) {
        failures.push({ ...call, error })
        throw error
      }
    }

  const client: ComfyClient = {
    systemStats: wrap('systemStats', () => inner.systemStats()),
    modelFiles: wrap('modelFiles', (folder: string) => inner.modelFiles(folder)),
    nodeInfo: wrap('nodeInfo', (classType: string) => inner.nodeInfo(classType)),
    uploadImage: wrap('uploadImage', (name: string, bytes: Uint8Array) =>
      inner.uploadImage(name, bytes),
    ),
    submit: wrap('submit', (id: string, graph: Record<string, unknown>) => inner.submit(id, graph)),
    history: wrap('history', (id: string) => inner.history(id)),
    jobState: wrap('jobState', (id: string) => inner.jobState(id)),
    queueIds: wrap('queueIds', () => inner.queueIds()),
    removeFromQueue: wrap('removeFromQueue', (id: string) => inner.removeFromQueue(id)),
    interrupt: wrap('interrupt', (id: string) => inner.interrupt(id)),
    viewFile: wrap('viewFile', (ref: Parameters<ComfyClient['viewFile']>[0], max: number) =>
      inner.viewFile(ref, max),
    ),
    adopt: (id) => inner.adopt(id),
  }
  return { client, calls, failures }
}

export type Recorded = ReturnType<typeof recordCalls>

// The calls a case made that it did not mean to make.
export function unexpectedCalls(calls: readonly Call[], allowed: readonly CallName[]): Call[] {
  return calls.filter((c) => !allowed.includes(c.name))
}

// Removing or interrupting is only ever asked for an ID this case submitted.
export function foreignCancels(calls: readonly Call[]): Call[] {
  const own = new Set(calls.filter((c) => c.name === 'submit').map((c) => c.arg))
  return calls.filter(
    (c) => (c.name === 'removeFromQueue' || c.name === 'interrupt') && !own.has(c.arg),
  )
}
