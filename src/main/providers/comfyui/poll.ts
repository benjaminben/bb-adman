// SPEC 6.10.6 step 6 [REQ: FR-268, FR-269]: poll one submitted run until the server's history
// holds it. A failed poll is not a failure: polls go on until one succeeds or 5 minutes pass
// (lost_contact). In neither the queue nor the history on two polls in a row: server_stopped.
// Over the waiting or working limit: too_long. The shapes of a job state are not verified
// (U-2); the status words are read as in today's server and corrected after the trial.
import type { RunProgress } from '../types'
import { ProviderFailure } from '../types'
import type { HistoryEntry } from './answers'
import type { ComfyClient } from './client'
import { comfyFailure } from './failures'
import { LOST_CONTACT_MS, PICTURE_WORK_MS, POLL_MS, QUEUE_WAIT_MS } from './limits'
import type { RunTiming } from './run'

export type PollClient = Pick<ComfyClient, 'history' | 'jobState' | 'queueIds'>

type Seen =
  | { at: 'history'; entry: HistoryEntry }
  | { at: 'waiting'; queuePosition?: number }
  | { at: 'working' }
  | { at: 'nowhere' }

const WAITING = new Set(['pending', 'queued'])
const WORKING = new Set(['in_progress', 'running', 'executing'])

async function look(client: PollClient, promptId: string): Promise<Seen> {
  const entry = await client.history(promptId)
  if (entry) return { at: 'history', entry }
  const state = await client.jobState(promptId)
  if (state) {
    if (WAITING.has(state.status)) return { at: 'waiting' }
    return WORKING.has(state.status) ? { at: 'working' } : { at: 'nowhere' }
  }
  // The server has no job route: the queue says where the run is.
  const queue = await client.queueIds()
  if (queue.running.includes(promptId)) return { at: 'working' }
  const place = queue.pending.indexOf(promptId)
  return place === -1 ? { at: 'nowhere' } : { at: 'waiting', queuePosition: place + 1 }
}

const isBreak = (e: unknown) => e instanceof ProviderFailure && e.error.kind === 'offline'

// Runs `attempt` until it gives an answer. A break in contact is tried again every poll
// interval until LOST_CONTACT_MS have passed since the first break in a row.
export async function throughBreaks<T>(
  timing: RunTiming,
  attempt: () => Promise<T>,
  signal?: AbortSignal,
): Promise<T> {
  let since: number | null = null
  for (;;) {
    try {
      return await attempt()
    } catch (e) {
      if (!isBreak(e)) throw e
      since ??= timing.now()
      if (timing.now() - since >= LOST_CONTACT_MS) {
        throw comfyFailure('lost_contact', 'Polls failed for 5 minutes', 'offline')
      }
    }
    await timing.sleep(POLL_MS, signal)
    if (signal?.aborted) throw new PollStopped()
  }
}

// The signal fired while polling.
export class PollStopped extends Error {
  constructor() {
    super('Polling stopped')
    this.name = 'PollStopped'
  }
}

export async function pollRun(
  client: PollClient,
  promptId: string,
  timing: RunTiming,
  opts: { signal?: AbortSignal; onProgress?: (p: RunProgress) => void },
): Promise<HistoryEntry> {
  const started = timing.now()
  let workingSince: number | null = null
  let missed = 0
  let shown = ''
  for (;;) {
    await timing.sleep(POLL_MS, opts.signal)
    if (opts.signal?.aborted) throw new PollStopped()
    const seen = await throughBreaks(timing, () => look(client, promptId), opts.signal)
    if (seen.at === 'history') return seen.entry
    if (seen.at === 'nowhere') {
      missed += 1
      if (missed >= 2) throw comfyFailure('server_stopped', 'The run is in neither place')
      continue
    }
    missed = 0
    const progress: RunProgress =
      seen.at === 'waiting'
        ? { stage: 'waiting', ...(seen.queuePosition && { queuePosition: seen.queuePosition }) }
        : { stage: 'working' }
    // Review O-6: report only when the stage or the place in the queue changed.
    const key = `${progress.stage}:${progress.queuePosition ?? ''}`
    if (key !== shown) opts.onProgress?.(progress)
    shown = key
    const now = timing.now()
    if (seen.at === 'working') workingSince ??= now
    const over =
      workingSince === null ? now - started > QUEUE_WAIT_MS : now - workingSince > PICTURE_WORK_MS
    if (over) throw comfyFailure('too_long', 'Over the waiting or working limit', 'timeout')
  }
}
