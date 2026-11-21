// SPEC 14 1.41 CU-5a, 1.46: one run at client level, for the run cases: `submit`, poll,
// `viewFile`. CU-5a comes before CU-4 and uses the client only; this is not the adapter's run.
// It waits behind other work and never asks for a clean queue. A run that runs out of time
// cancels its own run, by its own ID, and fails. Its waits are constants here (1.43 K-3).
import type { ComfyClient, ViewRef } from '../../src/main/providers/comfyui/client'
import { ComfyRefused } from '../../src/main/providers/comfyui/refusal'
import type { HistoryEntry } from '../../src/main/providers/comfyui/answers'
import type { Graph, WorkflowSpec } from '../../src/main/providers/comfyui/workflows/types'
import { isViewType } from '../../src/main/providers/comfyui/values'
import type { Print } from './print'
import { refusalLines, runErrorLines } from './server-lines'
import { MIN_TARGETED_INTERRUPT, versionAtLeast } from './version'

export const POLL_MS = 2_000
// 6.10.12: a picture case waits up to 30 minutes; 1.41: a video case up to 60.
export const PICTURE_LIMIT_MS = 30 * 60_000
export const VIDEO_LIMIT_MS = 60 * 60_000

export type Timing = {
  pollMs: number
  limitMs: number
  now: () => number
  sleep: (ms: number) => Promise<void>
}

export function realTiming(limitMs: number): Timing {
  return {
    pollMs: POLL_MS,
    limitMs,
    now: Date.now,
    sleep: (ms) => new Promise((done) => setTimeout(done, ms)),
  }
}

export type RunResult = {
  entry: HistoryEntry
  job: { status: string } | null
  waitingMs: number
  workingMs: number
  ref: ViewRef
  bytes: Uint8Array
}

const ended = (e: HistoryEntry) =>
  e.status?.completed === true || e.status?.statusStr === 'success' || failed(e)
const failed = (e: HistoryEntry) =>
  e.status?.statusStr === 'error' ||
  (e.status?.messages ?? []).some((m) => m.type === 'execution_error')

// Whether the run is still in the queue. The job state route first; the queue's IDs when the
// server has no such route.
async function waiting(client: ComfyClient, id: string, job: { status: string } | null) {
  if (job) return job.status === 'pending'
  const queue = await client.queueIds()
  return queue.pending.includes(id)
}

function outputRef(entry: HistoryEntry, node: string): ViewRef {
  for (const items of Object.values(entry.outputs[node] ?? {})) {
    const item = items.find((i) => i.filename !== undefined && i.type !== undefined)
    if (item?.filename && item.type && isViewType(item.type)) {
      return { filename: item.filename, subfolder: item.subfolder ?? '', type: item.type }
    }
  }
  throw new Error('The run gave no file for its output node')
}

type Seen = { working: boolean; jobsAnswered: boolean; version: string | undefined }

// SPEC 6.10.14: the own run always leaves the queue. `interrupt` is sent only when all hold:
// the run was seen working, /api/jobs answered at least once, and the server's version can be
// read and is MIN_TARGETED_INTERRUPT or later. A server too old to read the ID would stop
// whatever job is running, which could be someone else's work.
async function cancelOwn(
  client: ComfyClient,
  id: string,
  seen: Seen,
  print: Print,
): Promise<never> {
  await client.removeFromQueue(id)
  const targeted = versionAtLeast(seen.version ?? '', MIN_TARGETED_INTERRUPT)
  if (seen.working && seen.jobsAnswered && targeted) {
    await client.interrupt(id)
    throw new Error('The run ran out of time; its own run was cancelled')
  }
  print(
    'The run may still be running on the server: it was taken off the queue but not interrupted.',
  )
  throw new Error('The run ran out of time; its own run was taken off the queue, not interrupted')
}

async function submitted(client: ComfyClient, graph: Graph, id: string, print: Print) {
  try {
    return await client.submit(id, graph)
  } catch (error) {
    if (!(error instanceof ComfyRefused)) throw error
    print(...refusalLines(error.refusal, graph))
    throw refusedGraph()
  }
}

// The printed lines hold what may be shown; the error holds nothing from the server.
function refusedGraph(): Error {
  return new Error('The server refused the graph')
}

export async function runGraph(
  client: ComfyClient,
  spec: WorkflowSpec,
  graph: Graph,
  promptId: string,
  print: Print,
  timing: Timing,
  maxBytes: number,
  // The version from the case's own check; none means it cannot be read.
  serverVersion?: string,
): Promise<RunResult> {
  const { promptId: id } = await submitted(client, graph, promptId, print)
  const start = timing.now()
  let workingFrom: number | null = null
  let job: { status: string } | null = null
  let jobsAnswered = false
  for (;;) {
    const entry = await client.history(id)
    if (entry && ended(entry)) {
      const end = timing.now()
      const from = workingFrom ?? end
      if (failed(entry)) {
        print(...runErrorLines(entry.status?.messages ?? []))
        throw new Error('The run ended with an error')
      }
      const ref = outputRef(entry, spec.slots.outputNode)
      const bytes = await client.viewFile(ref, maxBytes)
      return { entry, job, waitingMs: from - start, workingMs: end - from, ref, bytes }
    }
    if (timing.now() - start >= timing.limitMs) {
      const seen = { working: workingFrom !== null, jobsAnswered, version: serverVersion }
      return cancelOwn(client, id, seen, print)
    }
    const answered = await client.jobState(id)
    if (answered) jobsAnswered = true
    job = answered ?? job
    if (workingFrom === null && !(await waiting(client, id, job))) workingFrom = timing.now()
    await timing.sleep(timing.pollMs)
  }
}

// Field names of a value, names only and never a value (CU-5a case 4). A list is marked [].
export function fieldNames(value: unknown, prefix = ''): string[] {
  if (Array.isArray(value)) {
    const first: unknown = value.find((v) => typeof v === 'object' && v !== null)
    return first === undefined ? [] : fieldNames(first, `${prefix}[]`)
  }
  if (typeof value !== 'object' || value === null) return []
  return Object.entries(value).flatMap(([key, inner]) => {
    const name = prefix === '' ? key : `${prefix}.${key}`
    return [name, ...fieldNames(inner, name)]
  })
}
