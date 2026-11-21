// Turns the MCP server on and off and replaces its token (SPEC 4.2, 5.1, 6.8).
// The token is read from and written to secrets.bin only; it is never logged or returned.
import type { SettingsStore } from '../settings/settings-store'
import type { SecretStore } from '../secrets/secret-store'
import type { ActivityLog } from '../log/activity-log'
import { AppError } from '../../shared/schemas/result'
import { makeToken } from './token'
import { McpPortInUse, type McpHttp } from './server'

export type McpService = ReturnType<typeof createMcpService>

export const portInUseMessage = (port: number) => `Port ${port} is in use. Choose another.`

type Deps = { http: McpHttp; settings: SettingsStore; secrets: SecretStore; log: ActivityLog }

export function createMcpService(deps: Deps) {
  const { http, settings, secrets } = deps

  async function listen(): Promise<void> {
    const port = settings.get().mcp.port
    const token = secrets.get('mcp.token') ?? null
    if (!token) throw new AppError('RULE_VIOLATION', 'No access token has been made.')
    try {
      await http.start({ port, token })
    } catch (e) {
      if (!(e instanceof McpPortInUse)) throw e
      throw new AppError('RULE_VIOLATION', portInUseMessage(port), { reason: 'port_in_use' })
    }
  }

  return {
    async setEnabled(enabled: boolean): Promise<void> {
      if (!enabled) {
        settings.setMcpEnabled(false)
        await http.stop()
        return
      }
      if (http.running()) return settings.setMcpEnabled(true)
      if (!secrets.get('mcp.token')) secrets.set('mcp.token', makeToken())
      // The setting is saved only once the server is listening (SPEC 6.8: it stays off).
      await listen()
      settings.setMcpEnabled(true)
    },

    // A new token closes the listener and drops every session (SPEC 5.1 step 4).
    async regenerateToken(): Promise<void> {
      secrets.set('mcp.token', makeToken())
      if (!http.running()) return
      await http.stop()
      try {
        await listen()
      } catch (e) {
        settings.setMcpEnabled(false)
        throw e
      }
    },

    // App start: listens only while the setting is on. A taken port leaves it off.
    async startIfEnabled(): Promise<void> {
      if (!settings.get().mcp.enabled) return
      try {
        await listen()
      } catch (e) {
        deps.log.write({
          level: 'warn',
          event: 'mcp',
          name: 'mcp.start',
          actor: 'system',
          ok: false,
          errorKind: e instanceof AppError ? e.code : 'INTERNAL',
          message: e instanceof AppError ? e.message : 'The MCP server did not start.',
        })
      }
    },

    stop: (): Promise<void> => http.stop(),
    running: (): boolean => http.running(),
    address: () => http.address(),
  }
}
