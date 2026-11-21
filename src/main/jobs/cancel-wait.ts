// SPEC 6.11.2 [1.38]: the one owner of the cancel waits. After a stop is asked, the runner
// waits this long for the handler to end before it ends the job as outcomeUnknown. An adapter
// has no cancel wait of its own.
const WAIT_MS = new Map<string, number>([
  ['comfyui', 60_000],
  ['fal-seedance', 600_000],
  ['fake', 5_000],
])
const OTHER_WAIT_MS = 60_000

// A close waits at most this long, for the whole project, for providers to confirm a stop.
export const CLOSE_WAIT_MS = 5_000

export function cancelWaitFor(providerId: string): number {
  return WAIT_MS.get(providerId) ?? OTHER_WAIT_MS
}
