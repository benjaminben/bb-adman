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
import { projectCommands } from './commands/project'
import { secretCommands } from './commands/secret'
import { settingsCommands } from './commands/settings'
import { createQueries } from './queries/queries'
import type { CoreDeps } from './core-deps'

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
  const deps: CoreDeps = {
    projects,
    settings,
    secrets,
    undo,
    providers,
    log,
    appVersion: opts.appVersion,
    now,
    userDataDir: opts.userDataDir,
  }

  // One spread line per domain, in alphabetical order (SPEC 12).
  const handlers = [...projectCommands(deps), ...secretCommands(deps), ...settingsCommands(deps)]

  const bus = createCommandBus({
    handlers,
    projects,
    undo,
    log,
    emit: opts.emit,
    askPermission: opts.askPermission,
  })

  return {
    bus,
    query: createQueries(deps),
    deps,
    commandNames: handlers.map((h) => h.name),
    projects,
    undo,
    secrets,
    settings,
    log,
    closeAll(): void {
      for (const handle of projects.all()) {
        projects.remove(handle.projectId)
        closeProjectFile(handle)
        undo.dropProject(handle.projectId)
      }
    },
  }
}
