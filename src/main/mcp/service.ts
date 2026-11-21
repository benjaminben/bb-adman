// Turns the MCP server on and off and replaces its token (SPEC 4.2, 5.1, 6.8).
// The token is read from and written to secrets.bin only; it is never logged or returned.
import type { SettingsStore } from '../settings/settings-store'
import type { SecretStore } from '../secrets/secret-store'
import type { ActivityLog } from '../log/activity-log'
import { AppError } from '../../shared/schemas/result'
import type { McpProblem } from '../../shared/schemas/queries/mcp'
import { makeToken } from './token'
import { McpPortInUse, type McpHttp } from './server'
import { createSerial } from './serial'

export type McpService = ReturnType<typeof createMcpService>

export const portInUseMessage = (port: number) => `Port ${port} is in use. Choose another.`

type Deps = { http: McpHttp; settings: SettingsStore; secrets: SecretStore; log: ActivityLog }

export function createMcpService(deps: Deps) {
  const { http, settings, secrets } = deps
  // Every operation waits for the one before, so a start, a stop and a new token never
  // overlap (REVIEW MCP-A R-1). A stop has finished closing before the next one begins.
  const serial = createSerial()
  // Set when the last start found its port taken (SPEC 14 1.58 J-8).
  let portTaken = false

  async function listen(): Promise<void> {
    const port = settings.get().mcp.port
    const token = secrets.get('mcp.token') ?? null
    if (!token) throw new AppError('RULE_VIOLATION', 'No access token has been made.')
    try {
      await http.start({ port, token })
      portTaken = false
    } catch (e) {
      if (!(e instanceof McpPortInUse)) throw e
      portTaken = true
      throw new AppError('RULE_VIOLATION', portInUseMessage(port), { reason: 'port_in_use' })
    }
  }

  async function stop(): Promise<void> {
    portTaken = false
    await http.stop()
  }

  // A start the user did not ask for just now (app start, port change): a failure is
  // logged and shown through getConnectInfo, never thrown (SPEC 14 1.58 J-7, J-8, J-11).
  // A restart stops first inside the same try, so a failed stop is logged too (S-2).
  async function tryListen(name: string, restart = false): Promise<void> {
    try {
      if (restart) await http.stop()
      await listen()
    } catch (e) {
      deps.log.write({
        level: 'warn',
        event: 'mcp',
        name,
        actor: 'system',
        ok: false,
        errorKind: e instanceof AppError ? e.code : 'INTERNAL',
        message: e instanceof AppError ? e.message : 'The MCP server did not start.',
      })
    }
  }

  return {
    setEnabled: (enabled: boolean): Promise<void> =>
      serial(async () => {
        if (!enabled) {
          settings.setMcpEnabled(false)
          return stop()
        }
        if (http.running()) return settings.setMcpEnabled(true)
        if (!secrets.get('mcp.token')) secrets.set('mcp.token', makeToken())
        // The setting is saved only once the server is listening (SPEC 6.8: it stays off).
        await listen()
        settings.setMcpEnabled(true)
      }),

    // A new token closes the listener and drops every session (SPEC 5.1 step 4). With the
    // setting on, the server then listens with the new token (SPEC 14 1.58 J-11).
    regenerateToken: (): Promise<void> =>
      serial(async () => {
        secrets.set('mcp.token', makeToken())
        if (!settings.get().mcp.enabled) return
        await http.stop()
        await listen()
      }),

    // App start: listens only while the setting is on. A taken port or a missing token
    // leaves the server off and the setting on (SPEC 14 1.58 J-8, J-11).
    startIfEnabled: (): Promise<void> =>
      serial(async () => {
        if (settings.get().mcp.enabled) await tryListen('mcp.start')
      }),

    // settings.update saved a new port: with the setting on, listen there (SPEC 14 1.58 J-7).
    portChanged: (): Promise<void> =>
      serial(async () => {
        if (!settings.get().mcp.enabled) return
        await tryListen('mcp.restart', true)
      }),

    stop: (): Promise<void> => serial(stop),
    running: (): boolean => http.running(),
    // SPEC 14 1.58 J-8, J-11: why the server is not running while the setting is on.
    problem(): McpProblem {
      if (http.running() || !settings.get().mcp.enabled) return null
      if (!secrets.get('mcp.token')) return 'token_missing'
      return portTaken ? 'port_in_use' : null
    },
    address: () => http.address(),
  }
}
