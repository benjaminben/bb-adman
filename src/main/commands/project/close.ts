// project.close (SPEC 4.2; FR-006). Undo lists are dropped when a project closes.
// [1.8] runningJobs (SPEC 3.6 "Jobs" item 6, slice D): refused with jobs_running while a job
// is queued or running, unless the input says 'stop'; then the runner cancels them first.
import { defineCommand } from '../types'
import { closeProjectFile } from '../../db/project-file'
import type { ProjectCommandDeps } from './deps'
import type { CoreDeps } from '../../core-deps'
import { NOT_OPEN_MESSAGE } from '../../db/project-registry'
import { projectCloseInput } from '../../../shared/schemas/commands/project'
import { AppError } from '../../../shared/schemas/result'

export function projectClose(deps: ProjectCommandDeps & Pick<CoreDeps, 'jobs'>) {
  return defineCommand({
    name: 'project.close',
    input: projectCloseInput,
    changesAppState: true,
    async run(_ctx, input) {
      const count = deps.projects.get(input.projectId) ? deps.jobs.activeCount(input.projectId) : 0
      if (count > 0 && input.runningJobs !== 'stop') {
        throw new AppError(
          'RULE_VIOLATION',
          'Work is still running in this project. Stop it, or wait for it to finish.',
          { reason: 'jobs_running', count },
        )
      }
      if (count > 0) await deps.jobs.cancelAll(input.projectId)
      const handle = deps.projects.remove(input.projectId)
      if (!handle) {
        throw new AppError('NOT_FOUND', NOT_OPEN_MESSAGE, {
          projectId: input.projectId,
          reason: 'project_not_open',
        })
      }
      closeProjectFile(handle)
      deps.undo.dropProject(input.projectId)
      return { data: { projectId: input.projectId }, log: { projectId: input.projectId } }
    },
  })
}
