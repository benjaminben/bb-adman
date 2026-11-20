import type { CoreDeps } from '../../core-deps'
import type { ProjectHandle } from '../../db/project-file'
import type { OpenProjectSummary } from '../../../shared/schemas/project'

export type ProjectCommandDeps = Pick<
  CoreDeps,
  'projects' | 'settings' | 'undo' | 'appVersion' | 'now'
>

export function summary(h: ProjectHandle): OpenProjectSummary {
  return { projectId: h.meta.projectId, name: h.meta.name, filePath: h.filePath }
}
