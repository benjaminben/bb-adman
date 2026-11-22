// The running "Update gallery" runs (round-2-approvals-video.md "Progress and Stop"): an
// in-memory map from `{projectId}/{campaignId}` to the run's stop controller and whether the
// gallery request has gone. One run per campaign at a time; another campaign is not held.
import { approvalsRefusal } from '@/shared/approvals/messages'

type Pair = { projectId: string; campaignId: string }

export type GalleryRun = { controller: AbortController; sent: boolean }

export type GalleryRuns = {
  // A new entry; update_running when the campaign already has one.
  start(pair: Pair): GalleryRun
  // Removes the entry, if it is still this run's.
  end(pair: Pair, run: GalleryRun): void
  // Stops the run unless its gallery request has gone; false when nothing was stopped.
  cancel(pair: Pair): boolean
}

const keyOf = (pair: Pair) => `${pair.projectId}/${pair.campaignId}`

export function createGalleryRuns(): GalleryRuns {
  const runs = new Map<string, GalleryRun>()
  return {
    start(pair) {
      if (runs.has(keyOf(pair))) throw approvalsRefusal('update_running')
      const run = { controller: new AbortController(), sent: false }
      runs.set(keyOf(pair), run)
      return run
    },
    end(pair, run) {
      if (runs.get(keyOf(pair)) === run) runs.delete(keyOf(pair))
    },
    cancel(pair) {
      const run = runs.get(keyOf(pair))
      if (!run || run.sent) return false
      run.controller.abort()
      return true
    },
  }
}
