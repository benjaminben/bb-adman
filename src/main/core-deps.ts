// The shared services handed to every domain (SPEC 12). core.ts builds this object once.
import type { ProjectRegistry } from './db/project-registry'
import type { SettingsStore } from './settings/settings-store'
import type { SecretStore } from './secrets/secret-store'
import type { UndoLists } from './history/undo-lists'
import type { ActivityLog } from './log/activity-log'
import type { ProviderInfo } from '../shared/schemas/queries/app'
import type { AssetService } from './assets/types'
import type { JobService } from './jobs/types'

export type CoreDeps = {
  projects: ProjectRegistry
  settings: SettingsStore
  secrets: SecretStore
  undo: UndoLists
  providers: ProviderInfo[]
  log: ActivityLog
  assets: AssetService
  jobs: JobService
  // Opens an https: address in the system browser (index.ts fills it from Electron).
  openExternal: (url: string) => Promise<void>
  // True only in an unpackaged app started with ADMAN_DEV_TOOLS=1 (SPEC 13).
  devTools: boolean
  appVersion: string
  now: () => Date
  userDataDir: string
}
