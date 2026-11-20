// The project files open in this app, by project ID.
import path from 'node:path'
import type { ProjectHandle } from './project-file'
import { AppError } from '../../shared/schemas/result'
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
    // The open project, or NOT_FOUND (SPEC 4.1). Nothing searches other projects.
    requireOpen(projectId: string): ProjectHandle {
      const handle = open.get(projectId)
      if (!handle) throw new AppError('NOT_FOUND', 'That project is not open.', { projectId })
      return handle
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
