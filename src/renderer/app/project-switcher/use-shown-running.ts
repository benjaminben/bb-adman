// SH-3: whether the shown project has a queued or running job, read from the activity rows the
// window already holds (ShownActivityScope; no new data, OI-DW-2). The switcher is also drawn
// on its own, without that scope (its own tests); then it shows no spinner. The scope is there
// or not for the switcher's whole life, so the hooks called stay the same on every render.
import { useActivity } from '@/renderer/app/activity-panel'

export function useShownRunning(shownId: string | null): boolean {
  try {
    return useActivity(
      (s) =>
        shownId !== null &&
        s.projectId === shownId &&
        s.rows.some((e) => e.job.status === 'queued' || e.job.status === 'running'),
    )
  } catch {
    return false
  }
}
