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
import { agentRunsCommands } from './commands/agent-runs'
import { approvalsCommands } from './commands/approvals'
import { createApprovalsDeps } from './approvals/deps'
import { assetCommands } from './commands/asset'
import { briefCommands } from './commands/brief'
import { campaignCommands } from './commands/campaign'
import { comfyCommands } from './commands/comfy'
import { devCommands } from './commands/dev'
import { directionCommands } from './commands/direction'
import { generationCommands } from './commands/generation'
import { jobCommands } from './commands/job'
import { layerCommands } from './commands/layer'
import { mcpCommands } from './commands/mcp'
import { projectCommands } from './commands/project'
import { ruleSetCommands } from './commands/rule-set'
import { secretCommands } from './commands/secret'
import { settingsCommands } from './commands/settings'
import { storageCommands } from './commands/storage'
import { subjectCommands } from './commands/subject'
import { syncCommands } from './commands/sync'
import { variantCommands } from './commands/variant'
import { createQueryRunner, queryTable } from './queries/queries'
import { createAssetService } from './assets/service'
import { createJobRunner } from './jobs/runner'
import { jobKindHandlers } from './jobs/kinds'
import { createRenderService } from './thumbnails/service'
import type { DrawScene } from './thumbnails/types'
import { agentCaller } from './mcp/agent-caller'
import { createMcpHttp } from './mcp/server'
import { createMcpService } from './mcp/service'
import { MCP_TOOLS, toolSetup } from './mcp/tools'
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
  openExternal?: (url: string) => Promise<void>
  devTools?: boolean
  toPng?: (bytes: Uint8Array) => Uint8Array
  fitPicture?: CoreDeps['fitPicture']
  webpToPng?: CoreDeps['webpToPng']
  // The Electron side of one draw (spec/scene.md, "One draw"); index.ts fills it.
  drawScene?: DrawScene
}

const noBrowser = async (): Promise<void> => {
  throw new Error('openExternal is not available')
}

const noConverter = (): Uint8Array => {
  throw new Error('toPng is not available')
}

const noFitter = (): Uint8Array => {
  throw new Error('fitPicture is not available')
}

const noWebp = async (): Promise<Uint8Array> => {
  throw new Error('webpToPng is not available')
}

const noDraw: DrawScene = async () => {
  throw new Error('drawScene is not available')
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
    // Slice WP, ruling F-9: every picture read for a provider is a clean PNG.
    assets: createAssetService({
      pictures: { toPng: (b) => deps.toPng(b), webpToPng: (b) => deps.webpToPng(b) },
    }),
    jobs: createJobRunner({
      deps: () => deps,
      bus: () => bus,
      emit: opts.emit,
      handlers: jobKindHandlers,
    }),
    render: createRenderService({
      deps: () => deps,
      bus: () => bus,
      emit: opts.emit,
      draw: opts.drawScene ?? noDraw,
    }),
    openExternal: opts.openExternal ?? noBrowser,
    devTools: opts.devTools ?? false,
    toPng: opts.toPng ?? noConverter,
    fitPicture: opts.fitPicture ?? noFitter,
    webpToPng: opts.webpToPng ?? noWebp,
    approvals: createApprovalsDeps({ ...opts, deps: () => deps }),
    appVersion: opts.appVersion,
    now,
    userDataDir: opts.userDataDir,
  }

  // The MCP server reaches core only through the agent caller, as actor agent (SPEC 4.1).
  // The tools are the fixed table of SPEC 4.5 built so far (SPEC 14, 1.56 MCP-B).
  const caller = agentCaller({
    execute: (name, input, o) => bus.execute(name, input, o),
    query: (name, input, o) => query(name, input, o),
  })
  const mcp = createMcpService({
    http: createMcpHttp({
      caller,
      appVersion: opts.appVersion,
      tools: toolSetup(MCP_TOOLS, providers),
    }),
    settings,
    secrets,
    log,
  })

  // One spread line per domain, in alphabetical order (SPEC 12).
  const handlers = [
    ...agentRunsCommands(deps),
    ...approvalsCommands(deps),
    ...assetCommands(deps),
    ...briefCommands(deps),
    ...campaignCommands(deps),
    ...comfyCommands(deps),
    ...devCommands(deps),
    ...directionCommands(deps),
    ...generationCommands(deps),
    ...jobCommands(deps),
    ...layerCommands(deps),
    ...mcpCommands(mcp),
    ...projectCommands(deps),
    ...ruleSetCommands(deps),
    ...secretCommands(deps),
    ...settingsCommands(deps, mcp),
    ...storageCommands(deps),
    ...subjectCommands(deps),
    ...syncCommands(deps),
    ...variantCommands(deps),
  ]

  const bus = createCommandBus({
    handlers,
    projects,
    undo,
    log,
    emit: opts.emit,
    askPermission: opts.askPermission,
    agentRuns: { providers, settings },
  })
  const queries = queryTable(deps, mcp)
  const query = createQueryRunner(queries, log)

  return {
    bus,
    query,
    mcp,
    deps,
    commandNames: handlers.map((h) => h.name),
    queryNames: Object.keys(queries),
    isInternal: (name: string) => handlers.some((h) => h.name === name && h.internal),
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
    // spec/jobs.md, "Closing a project and quitting": quitting after the warning closes every
    // project through project.close with 'stop', so no row stays queued or running; whatever
    // a refused close leaves open is then closed as closeAll does.
    async closeAllStopping(): Promise<void> {
      await Promise.all(
        projects
          .all()
          .map((h) =>
            bus.execute(
              'project.close',
              { projectId: h.projectId, runningJobs: 'stop' },
              { actor: 'user' },
            ),
          ),
      )
      this.closeAll()
    },
  }
}
