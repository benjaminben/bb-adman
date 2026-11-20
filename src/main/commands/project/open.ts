// project.open (SPEC 4.2, 3.8; FR-002, FR-003, R-06).
import path from 'node:path'
import { defineCommand } from '../types'
import { closeProjectFile, openProjectFile } from '../../db/project-file'
import { summary, type ProjectCommandDeps } from './deps'
import { projectOpenInput } from '../../../shared/schemas/commands/project'
import { AppError } from '../../../shared/schemas/result'

export const DUPLICATE_MESSAGE =
  'A copy of this project is already open. Close it first. To work on both, make the copy with Package project.'

export function projectOpen(deps: ProjectCommandDeps) {
  // The open-projects list is keyed by project ID, so a different file holding an open
  // project's ID is closed again and refused (SPEC 4.2 notes).
  function openNew(filePath: string) {
    const handle = openProjectFile({
      filePath: path.resolve(filePath),
      appVersion: deps.appVersion,
    })
    if (deps.projects.get(handle.meta.projectId)) {
      closeProjectFile(handle)
      throw new AppError('RULE_VIOLATION', DUPLICATE_MESSAGE, { reason: 'duplicate_project' })
    }
    deps.projects.add(handle)
    return handle
  }

  return defineCommand({
    name: 'project.open',
    input: projectOpenInput,
    changesAppState: true,
    run(_ctx, input) {
      if (!path.isAbsolute(input.filePath)) {
        throw new AppError('INVALID_INPUT', 'Choose an Adman project file (.adman).')
      }
      const now = deps.now().toISOString()
      // Opening a project that is already open shows its tab instead of failing on the lock.
      const handle = deps.projects.findByPath(input.filePath) ?? openNew(input.filePath)
      deps.settings.touchRecent({ path: handle.filePath, name: handle.meta.name }, now)
      return { data: summary(handle), log: { projectId: handle.meta.projectId } }
    },
  })
}
