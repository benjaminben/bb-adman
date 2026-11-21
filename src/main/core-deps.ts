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
  // Turns a JPEG (or PNG) into PNG bytes; throws when it cannot (SPEC 6.2 [1.18]).
  // index.ts fills it from Electron's nativeImage.
  toPng: (bytes: Uint8Array) => Uint8Array
  // [1.24] Crops a picture to the exact size, centred and filled, then scales it; PNG out,
  // behind the same limits as toPng (SPEC 6.10.7). index.ts fills it from CU-6.
  fitPicture: (bytes: Uint8Array, size: { width: number; height: number }) => Uint8Array
  appVersion: string
  now: () => Date
  userDataDir: string
}
