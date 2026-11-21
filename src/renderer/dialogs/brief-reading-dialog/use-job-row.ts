// The latest row of one job: from job.updated, and once from job.get in case the job moved on
// (or ended) before this window followed it. An ended row is final: a late, older answer from
// job.get does not replace it.
import { useEffect, useState } from 'react'
import { useApi } from '@/renderer/app/app-context'
import type { JobRow } from '@/shared/schemas/rows/job'

export const jobEnded = (row: JobRow | null) =>
  row !== null && row.status !== 'queued' && row.status !== 'running'

export function useJobRow(projectId: string, jobId: string): JobRow | null {
  const api = useApi()
  const [row, setRow] = useState<JobRow | null>(null)

  useEffect(() => {
    let live = true
    const take = (next: JobRow) => {
      if (live && next.id === jobId) setRow((held) => (jobEnded(held) ? held : next))
    }
    const off = api.on('job.updated', take)
    void api.query('job.get', { projectId, jobId }).then((reply) => {
      if (reply.ok && reply.data !== null) take(reply.data as JobRow)
    })
    return () => {
      live = false
      off()
    }
  }, [api, projectId, jobId])

  return row
}
