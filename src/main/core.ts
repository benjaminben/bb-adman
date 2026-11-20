// Builds the main-process services without Electron, so tests drive the same code
// the app runs. src/main/index.ts supplies the Electron parts.
import path from 'node:path'
import { createActivityLog, parseLogLevel } from './log/activity-log'
import { createSettingsStore } from './settings/settings-store'
import { defaultSettings } from './settings/defaults'
import { createSecretStore, type SecretCrypto } from './secrets/secret-store'
import { createProjectRegistry } from './db/project-registry'
import { closeProjectFile } from './db/project-file'
import { createUndoLists } from './history/undo-lists'
import { listProviders } from './providers/registry'
import { createCommandBus, type BusEvent, type PermissionRequest } from './commands/bus'
import { projectCreate } from './commands/project/create'
import { projectOpen } from './commands/project/open'
import { projectClose } from './commands/project/close'
import { settingsUpdate } from './commands/settings/update'
import { secretSet, secretDelete } from './commands/secret/secret'
import { createQueries } from './queries/queries'

export type { SecretCrypto }

export type CoreOptions = {
  userDataDir: string
  documentsDir: string
  appVersion: string
  crypto: SecretCrypto
  env: Record<string, string | undefined>
  emit: (event: BusEvent) => void
  askPermission: (request: PermissionRequest) => Promise<boolean>
  now?: () => Date
}

export type Core = ReturnType<typeof createCore>

export function createCore(opts: CoreOptions) {
  const now = opts.now ?? (() => new Date())
  const log = createActivityLog({
    dir: path.join(opts.userDataDir, 'logs'),
    minLevel: parseLogLevel(opts.env.ADMAN_LOG_LEVEL),
    now,
  })
  log.prune()
  const settings = createSettingsStore({
    file: path.join(opts.userDataDir, 'settings.json'),
    defaults: defaultSettings(opts.documentsDir),
  })
  const secrets = createSecretStore({
    file: path.join(opts.userDataDir, 'secrets.bin'),
    crypto: opts.crypto,
  })
  const projects = createProjectRegistry()
  const undo = createUndoLists()
  const providers = listProviders(opts.env)
  const projectDeps = { projects, settings, undo, appVersion: opts.appVersion, now }

  const bus = createCommandBus({
    handlers: [
      projectCreate(projectDeps),
      projectOpen(projectDeps),
      projectClose(projectDeps),
      settingsUpdate({ settings, providers }),
      secretSet({ secrets }),
      secretDelete({ secrets }),
    ],
    projects,
    undo,
    log,
    emit: opts.emit,
    askPermission: opts.askPermission,
  })

  return {
    bus,
    query: createQueries({ projects, settings, secrets, undo, providers }),
    projects,
    undo,
    secrets,
    settings,
    log,
    closeAll(): void {
      for (const handle of projects.all()) {
        projects.remove(handle.meta.projectId)
        closeProjectFile(handle)
        undo.dropProject(handle.meta.projectId)
      }
    },
  }
}
