// project.open (SPEC 4.2, 3.8; FR-002, FR-003, R-06).
import path from 'node:path'
import { defineCommand } from '@/main/commands/types'
import { closeProjectFile, openProjectFile } from '@/main/db/project-file'
import { summary, type ProjectCommandDeps } from './deps'
import type { CoreDeps } from '@/main/core-deps'
import { projectOpenInput } from '@/shared/schemas/commands/project'
import { AppError } from '@/shared/schemas/result'

export const DUPLICATE_MESSAGE =
  'A copy of this project is already open. Close it first. To work on both, make the copy with Package project.'

// [1.38] Settles the rows a process that is gone left queued or running (SPEC 3.6 "Jobs").
// A failure is one warn line holding the error's name only; the open still succeeds.
async function settleLeftOvers(deps: Pick<CoreDeps, 'jobs' | 'log'>, projectId: string) {
  try {
    await deps.jobs.projectOpened(projectId)
  } catch (error) {
    deps.log.write({
      level: 'warn',
      event: 'job',
      name: 'job.projectOpened',
      actor: 'system',
      projectId,
      ok: false,
      message: 'Jobs left running could not be settled.',
      context: { error: { name: error instanceof Error ? error.name : typeof error } },
    })
  }
}

export function projectOpen(deps: ProjectCommandDeps & Pick<CoreDeps, 'jobs' | 'log'>) {
  // The open-projects list is keyed by project ID, so a different file holding an open
  // project's ID is closed again and refused (SPEC 4.2 notes).
  function openNew(filePath: string) {
    const handle = openProjectFile({
      filePath: path.resolve(filePath),
      appVersion: deps.appVersion,
    })
    if (deps.projects.get(handle.projectId)) {
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
    async run(_ctx, input) {
      if (!path.isAbsolute(input.filePath)) {
        throw new AppError('INVALID_INPUT', 'Choose an Adman project file (.adman).')
      }
      const now = deps.now().toISOString()
      // Opening a project that is already open shows its tab instead of failing on the lock.
      const alreadyOpen = deps.projects.findByPath(input.filePath)
      const handle = alreadyOpen ?? openNew(input.filePath)
      // The runner hears of a fresh open before anything else can run (review D-04).
      if (!alreadyOpen) await settleLeftOvers(deps, handle.projectId)
      const data = summary(handle)
      deps.settings.touchRecent({ path: handle.filePath, name: data.name }, now)
      return { data, log: { projectId: handle.projectId } }
    },
  })
}
