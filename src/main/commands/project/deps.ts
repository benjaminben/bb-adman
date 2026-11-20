import type { ProjectRegistry } from '../../db/project-registry'
import type { SettingsStore } from '../../settings/settings-store'
import type { UndoLists } from '../../history/undo-lists'
import type { ProjectHandle } from '../../db/project-file'
import type { OpenProjectSummary } from '../../../shared/schemas/project'

export type ProjectCommandDeps = {
  projects: ProjectRegistry
  settings: SettingsStore
  undo: UndoLists
  appVersion: string
  now: () => Date
}

export function summary(h: ProjectHandle): OpenProjectSummary {
  return { projectId: h.meta.projectId, name: h.meta.name, filePath: h.filePath }
}
