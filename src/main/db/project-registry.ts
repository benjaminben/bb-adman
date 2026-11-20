// The project files open in this app, by project ID.
import path from 'node:path'
import type { ProjectHandle } from './project-file'
import type { OpenProjectSummary } from '../../shared/schemas/project'

export type ProjectRegistry = ReturnType<typeof createProjectRegistry>

export function createProjectRegistry() {
  const open = new Map<string, ProjectHandle>()

  return {
    add(handle: ProjectHandle) {
      open.set(handle.meta.projectId, handle)
    },
    get(projectId: string): ProjectHandle | undefined {
      return open.get(projectId)
    },
    remove(projectId: string): ProjectHandle | undefined {
      const handle = open.get(projectId)
      open.delete(projectId)
      return handle
    },
    findByPath(filePath: string): ProjectHandle | undefined {
      const wanted = path.resolve(filePath)
      return [...open.values()].find((h) => path.resolve(h.filePath) === wanted)
    },
    all(): ProjectHandle[] {
      return [...open.values()]
    },
    summaries(): OpenProjectSummary[] {
      return [...open.values()].map((h) => ({
        projectId: h.meta.projectId,
        name: h.meta.name,
        filePath: h.filePath,
      }))
    },
  }
}
