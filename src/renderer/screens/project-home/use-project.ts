// The project page's copy of project.get (SPEC 14 1.41 TP-1). It is read on open and again
// on each project.changed for this project; an event for another project is ignored.
import { useEffect, useState } from 'react'
import { useApi } from '@/renderer/app/app-context'
import type { ProjectGet } from '@/shared/schemas/queries/campaign'

export function useProject(projectId: string): ProjectGet | null {
  const api = useApi()
  const [project, setProject] = useState<ProjectGet | null>(null)

  useEffect(() => {
    let live = true
    const read = () =>
      void api.query('project.get', { projectId }).then((result) => {
        if (live && result.ok && result.data) setProject(result.data as ProjectGet)
      })
    read()
    const stop = api.on('project.changed', (payload) => {
      if (payload.projectId === projectId) read()
    })
    return () => {
      live = false
      stop()
    }
  }, [api, projectId])

  return project
}
