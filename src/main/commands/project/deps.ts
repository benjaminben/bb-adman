import type { CoreDeps } from '../../core-deps'
import type { ProjectHandle } from '../../db/project-file'
import { readMeta } from '../../db/meta'
import type { OpenProjectSummary } from '../../../shared/schemas/project'

export type ProjectCommandDeps = Pick<
  CoreDeps,
  'projects' | 'settings' | 'undo' | 'appVersion' | 'now'
>

export function summary(h: ProjectHandle): OpenProjectSummary {
  return { projectId: h.projectId, name: readMeta(h.db).name, filePath: h.filePath }
}
