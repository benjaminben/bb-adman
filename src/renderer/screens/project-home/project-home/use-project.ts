// The project page's copy of project.get (SPEC 14 1.41 TP-1). It is read on open and again
// on each project.changed for this project; an event for another project is ignored.
// spec/jobs.md, "Marks" [FR-218]: the campaigns' "Running" and "New result" marks come from
// the job table, so it is also read on job.updated for a job of one of this project's
// campaigns, but only when that job's mark moves (active, unseen or neither). A long run's
// progress ticks read nothing. job.updated carries no project ID; the campaign ID decides.
import { useEffect, useState } from 'react'
import { useApi } from '@/renderer/app/app-context'
import type { ProjectGet } from '@/shared/schemas/queries/campaign'
import type { JobRow } from '@/shared/schemas/rows/job'

type Mark = 'active' | 'unseen' | 'neither'

function markOf(job: JobRow): Mark {
  if (job.status === 'queued' || job.status === 'running') return 'active'
  if (job.status === 'succeeded' && job.seenAt === null) return 'unseen'
  return 'neither'
}

export function useProject(projectId: string): ProjectGet | null {
  const api = useApi()
  const [project, setProject] = useState<ProjectGet | null>(null)

  useEffect(() => {
    let live = true
    let campaignIds = new Set<string>()
    const marks = new Map<string, Mark>()
    const read = () =>
      void api.query('project.get', { projectId }).then((result) => {
        if (!live || !result.ok || !result.data) return
        const data = result.data as ProjectGet
        campaignIds = new Set(data.campaigns.map((c) => c.id))
        setProject(data)
      })
    read()
    const stops = [
      api.on('project.changed', (payload) => {
        if (payload.projectId === projectId) read()
      }),
      api.on('job.updated', (job) => {
        if (job.campaignId === null || !campaignIds.has(job.campaignId)) return
        const mark = markOf(job)
        if (marks.get(job.id) === mark) return
        marks.set(job.id, mark)
        read()
      }),
    ]
    return () => {
      live = false
      for (const stop of stops) stop()
    }
  }, [api, projectId])

  return project
}
