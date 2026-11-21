// CU-9 [REQ: FR-269]: one place where a run's polls and its live connection meet. onProgress
// is called only when the stage, the queue position or the whole percent changed; each call
// is one database write and one job.updated event. A working run does not go back to waiting
// on a poll that arrives late.
import type { RunProgress } from '@/main/providers/types'

const wholePercent = (fraction: number) => Math.min(100, Math.max(0, Math.floor(fraction * 100)))

export function progressReporter(
  onProgress: ((p: RunProgress) => void) | undefined,
): (p: RunProgress) => void {
  let shown: RunProgress | null = null
  let percent: number | undefined
  return (p) => {
    if (shown?.stage === 'working' && p.stage === 'waiting') return
    if (shown?.stage !== p.stage) percent = undefined
    if (p.fraction !== undefined) percent = wholePercent(p.fraction)
    const next: RunProgress = {
      stage: p.stage,
      ...(p.stage === 'waiting' &&
        p.queuePosition !== undefined && {
          queuePosition: p.queuePosition,
        }),
      ...(percent !== undefined && { fraction: percent / 100 }),
    }
    const same =
      shown !== null &&
      shown.stage === next.stage &&
      shown.queuePosition === next.queuePosition &&
      shown.fraction === next.fraction
    if (same) return
    shown = next
    onProgress?.(next)
  }
}
