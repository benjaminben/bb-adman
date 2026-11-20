// The shared services handed to every domain (SPEC 12). core.ts builds this object once.
import type { ProjectRegistry } from './db/project-registry'
import type { SettingsStore } from './settings/settings-store'
import type { SecretStore } from './secrets/secret-store'
import type { UndoLists } from './history/undo-lists'
import type { ActivityLog } from './log/activity-log'
import type { ProviderInfo } from '../shared/schemas/queries/app'

export type CoreDeps = {
  projects: ProjectRegistry
  settings: SettingsStore
  secrets: SecretStore
  undo: UndoLists
  providers: ProviderInfo[]
  log: ActivityLog
  appVersion: string
  now: () => Date
  userDataDir: string
}
