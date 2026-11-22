// The started publish (DLG-6b): followed through job.updated for its own ID only, from the
// dialog's first draw, so a row that comes before publish.run's reply is kept and the reply
// finds it. It only reads; it sends nothing.
import { useCallback, useEffect, useRef, useState } from 'react'
import { useApi } from '@/renderer/app/app-context'
import type { JobRow } from '@/shared/schemas/rows/job'
import type { Result } from '@/shared/schemas/result'

export type PublishJob =
  | { kind: 'running'; value: number | null }
  | { kind: 'ended'; status: 'succeeded' | 'failed' | 'cancelled' }

function jobOf(row: JobRow): PublishJob {
  if (row.status === 'queued' || row.status === 'running')
    return { kind: 'running', value: row.progress }
  return { kind: 'ended', status: row.status }
}

export function jobIdOf(reply: Result<unknown>): string | null {
  if (!reply.ok || typeof reply.data !== 'object' || reply.data === null) return null
  const { jobId } = reply.data as { jobId?: unknown }
  return typeof jobId === 'string' ? jobId : null
}

export function usePublishJob() {
  const api = useApi()
  const [job, setJob] = useState<PublishJob | null>(null)
  const seen = useRef(new Map<string, JobRow>())
  const jobId = useRef<string | null>(null)

  useEffect(
    () =>
      api.on('job.updated', (row) => {
        if (row.kind !== 'publish') return
        seen.current.set(row.id, row)
        if (row.id === jobId.current) setJob(jobOf(row))
      }),
    [api],
  )

  const follow = useCallback((id: string | null) => {
    jobId.current = id
    const row = id === null ? undefined : seen.current.get(id)
    setJob(row ? jobOf(row) : { kind: 'running', value: null })
  }, [])

  return { job, follow }
}
