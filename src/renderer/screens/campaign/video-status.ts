// What a video run's row says while it runs (SPEC 14 1.57 TP-6 "While it runs"): "Waiting
// (place n)" while the server holds it in its queue, else "Working, m min" from the row's
// start time. No percentage: the poll gives none.
import { useEffect, useState } from 'react'
import type { JobRow } from '@/shared/schemas/rows/job'

export function videoRunningText(row: JobRow, nowMs: number): string {
  const shown = (typeof row.result === 'object' && row.result !== null ? row.result : {}) as {
    stage?: unknown
    queuePosition?: unknown
  }
  if (shown.stage === 'waiting') {
    return typeof shown.queuePosition === 'number'
      ? `Waiting (place ${shown.queuePosition})`
      : 'Waiting'
  }
  const minutes = Math.max(Math.floor((nowMs - Date.parse(row.createdAt)) / 60_000), 0)
  return `Working, ${Number.isNaN(minutes) ? 0 : minutes} min`
}

// The time now, read again every 15 seconds while `ticking` is true.
export function useNow(ticking: boolean): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!ticking) return
    const timer = setInterval(() => setNow(Date.now()), 15_000)
    return () => clearInterval(timer)
  }, [ticking])
  return now
}
