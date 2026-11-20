// project.open (SPEC 4.2, 3.8; FR-002, FR-003, R-06).
import path from 'node:path'
import { defineCommand } from '../types'
import { openProjectFile } from '../../db/project-file'
import { summary, type ProjectCommandDeps } from './deps'
import { projectOpenInput } from '../../../shared/schemas/commands/project'
import { AppError } from '../../../shared/schemas/result'

export function projectOpen(deps: ProjectCommandDeps) {
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
      const handle =
        deps.projects.findByPath(input.filePath) ??
        openProjectFile({ filePath: path.resolve(input.filePath), appVersion: deps.appVersion })
      deps.projects.add(handle)
      deps.settings.touchRecent({ path: handle.filePath, name: handle.meta.name }, now)
      return { data: summary(handle) }
    },
  })
}
