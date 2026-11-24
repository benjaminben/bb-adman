// The latest approvals.progress of this campaign's "Update gallery" and "Stop", read from the
// app store's owner of the update (D-110, gallery-updates.ts), so a dialog drawn again shows
// where the update is. The line of words and the bar's value (spec/approvals.md "An update in
// the background").
import { useApp } from '@/renderer/app/app-context'
import { updateKey, type UpdateCounts } from '@/renderer/stores/gallery-updates'

export type UpdateProgress = {
  step: UpdateCounts | null
  stopping: boolean
  stop: () => void
}

export function useUpdateProgress(projectId: string, campaignId: string): UpdateProgress {
  const update = useApp((s) => s.updates[updateKey(projectId, campaignId)])
  const stopUpdate = useApp((s) => s.stopUpdate)
  return {
    step: update?.progress ?? null,
    stopping: update?.stopping ?? false,
    stop: () => stopUpdate(projectId, campaignId),
  }
}

const NOUNS = { drawing: 'Sending picture', making: 'Making video', sending: 'Sending video' }

export function progressLine(p: UpdateProgress): string {
  if (p.stopping) return 'Stopping…'
  if (p.step === null) return 'Updating the gallery…'
  if (p.step.step === 'finishing') return 'Finishing…'
  return `${NOUNS[p.step.step]} ${p.step.done + 1} of ${p.step.total}…`
}

// unitsDone / unitsTotal, or null before the first event and when the run has no units.
export function progressValue(p: UpdateProgress): number | null {
  if (p.step === null || p.step.unitsTotal === 0) return null
  return p.step.unitsDone / p.step.unitsTotal
}
