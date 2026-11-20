// project.close (SPEC 4.2; FR-006). Undo lists are dropped when a project closes.
import { defineCommand } from '../types'
import { closeProjectFile } from '../../db/project-file'
import type { ProjectCommandDeps } from './deps'
import { projectCloseInput } from '../../../shared/schemas/commands/project'
import { AppError } from '../../../shared/schemas/result'

export function projectClose(deps: ProjectCommandDeps) {
  return defineCommand({
    name: 'project.close',
    input: projectCloseInput,
    changesAppState: true,
    run(_ctx, input) {
      const handle = deps.projects.remove(input.projectId)
      if (!handle) throw new AppError('NOT_FOUND', 'That project is not open.')
      closeProjectFile(handle)
      deps.undo.dropProject(input.projectId)
      return { data: { projectId: input.projectId }, log: { projectId: input.projectId } }
    },
  })
}
