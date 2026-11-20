// The project files open in this app, by project ID.
import fs from 'node:fs'
import path from 'node:path'
import type { ProjectHandle } from './project-file'
import { AppError } from '../../shared/schemas/result'
import type { OpenProjectSummary } from '../../shared/schemas/project'

export const NOT_OPEN_MESSAGE = 'That project is not open.'

// Resolves links, and gives the letter case stored on disk where the file system ignores
// case. A path that does not exist is compared as written.
function realPath(filePath: string): string {
  try {
    return fs.realpathSync.native(filePath)
  } catch {
    return path.resolve(filePath)
  }
}

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
      if (!handle)
        throw new AppError('NOT_FOUND', NOT_OPEN_MESSAGE, { projectId, reason: 'project_not_open' })
      return handle
    },
    remove(projectId: string): ProjectHandle | undefined {
      const handle = open.get(projectId)
      open.delete(projectId)
      return handle
    },
    // Two paths are the same file when their real paths match (SPEC 4.2 notes).
    findByPath(filePath: string): ProjectHandle | undefined {
      const wanted = realPath(filePath)
      return [...open.values()].find((h) => realPath(h.filePath) === wanted)
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
