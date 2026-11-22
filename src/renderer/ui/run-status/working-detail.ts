// What a provider reports while it works (SPEC 6.11.1 [1.38]): read from `result` only when
// it is there and of the right type. Moved from the campaign page's run row (CAMP-7); the
// activity row shows it.
import type { JobRow } from '@/shared/schemas/rows/job'

export function workingDetail(row: JobRow): string {
  const shown = (typeof row.result === 'object' && row.result !== null ? row.result : {}) as {
    stage?: unknown
    queuePosition?: unknown
  }
  const parts: string[] = []
  if (typeof shown.stage === 'string') parts.push(shown.stage)
  if (typeof shown.queuePosition === 'number') parts.push(`place in queue ${shown.queuePosition}`)
  if (row.progress !== null) parts.push(`${Math.round(row.progress * 100)}%`)
  return parts.join(' · ')
}
