// The words of one earlier run (spec/screens-ai.md, "Earlier options"): its time as HH:MM, its
// kind ("Pictures" or "Cut-out"), its status, and the count a Retry asks for.
import { requestCount } from '@/renderer/stores/job-store'
import type { StatusMarkProps } from '@/renderer/ui/status-mark'
import { runName } from '@/renderer/ui/run-name/run-name'
import { picturesLeft } from '@/shared/generation/pictures-left'
import type { ProviderInfo } from '@/shared/schemas/queries/app'
import type { JobRow } from '@/shared/schemas/rows/job'

const pad = (n: number) => String(n).padStart(2, '0')

export function runTime(iso: string): string {
  const d = new Date(iso)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function runKind(row: JobRow): string {
  return row.kind === 'cutout' ? 'Cut-out' : 'Pictures'
}

// ED-4b: the status as a StatusMark; a succeeded run shows its options, so it has none.
export function runMark(row: JobRow): StatusMarkProps | null {
  const label = runStatus(row)
  if (label === null) return null
  if (row.status === 'failed') return { tone: 'danger', icon: 'xCircle', label, tip: label }
  if (row.status === 'cancelled') return { tone: 'none', label, tip: label }
  return { tone: 'running', label, tip: label }
}

// A succeeded run shows its options, so it has no status word.
export function runStatus(row: JobRow): string | null {
  if (row.status === 'queued') return 'Waiting'
  if (row.status === 'running') {
    return row.progress === null ? 'Working' : `Working ${Math.round(row.progress * 100)}%`
  }
  if (row.status === 'failed') return 'Failed'
  if (row.status === 'cancelled') return 'Cancelled'
  return null
}

// FN-4, as job.retry counts: a picture run asks only for the pictures it did not keep.
export function retryCount(row: JobRow): number | null {
  const count = requestCount(row)
  if (row.kind !== 'image_generation' || count === null) return null
  return picturesLeft(count, row.result)
}

export function referenceCount(row: JobRow): number {
  const request = row.request as { referenceAssetIds?: unknown } | null
  const ids = request?.referenceAssetIds
  return Array.isArray(ids) ? ids.length : 0
}

// A run's header, the tooltip of its row or strip: "21:06 · Google Gemini · Nano Banana 2.1 ·
// Pictures" (R3-2: the stored model's name, or its ID).
type Named = Pick<ProviderInfo, 'id' | 'label'> &
  Partial<Pick<ProviderInfo, 'defaultModels' | 'modelLabels'>>

export function runTitle(row: JobRow, providers: readonly Named[]): string {
  const label = runName(row, providers, null, 'The provider')
  return `${runTime(row.createdAt)} · ${label} · ${runKind(row)}`
}
