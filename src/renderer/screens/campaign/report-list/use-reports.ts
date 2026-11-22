// The campaign's report.list reply [P8-12], read on open, on project.changed for the project and
// when an export job of the campaign ends. Saving a report sends no project.changed, so the end
// of the job (the job.updated row the export dialog follows) is what brings a new report in.
import { useEffect, useState } from 'react'
import { useApi } from '@/renderer/app/app-context'
import type { ReportListReply } from '@/shared/schemas/queries/report'
import type { JobRow } from '@/shared/schemas/rows/job'

export type ReportsRead =
  | { kind: 'loading' }
  | { kind: 'shown'; reports: ReportListReply }
  | { kind: 'refused'; message: string }

const ENDED: ReadonlySet<JobRow['status']> = new Set(['succeeded', 'failed', 'cancelled'])

export function useReports(projectId: string, campaignId: string): ReportsRead {
  const api = useApi()
  const [read, setRead] = useState<ReportsRead>({ kind: 'loading' })
  useEffect(() => {
    let live = true
    const load = () =>
      void api.query('report.list', { projectId, campaignId }).then((reply) => {
        if (!live) return
        if (reply.ok) setRead({ kind: 'shown', reports: (reply.data as ReportListReply) ?? [] })
        else setRead({ kind: 'refused', message: reply.error.message })
      })
    load()
    const stops = [
      api.on('project.changed', (payload) => {
        if (payload.projectId === projectId) load()
      }),
      api.on('job.updated', (job) => {
        if (job.kind === 'export' && job.campaignId === campaignId && ENDED.has(job.status)) load()
      }),
    ]
    return () => {
      live = false
      for (const stop of stops) stop()
    }
  }, [api, projectId, campaignId])
  return read
}
