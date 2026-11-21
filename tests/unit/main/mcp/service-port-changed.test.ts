import { describe, it, expect } from 'vitest'
import { createMcpService } from '@/main/mcp/service'
import type { McpHttp } from '@/main/mcp/server'
import type { SettingsStore } from '@/main/settings/settings-store'
import type { SecretStore } from '@/main/secrets/secret-store'
import type { ActivityLog } from '@/main/log/activity-log'

// An HTTP door whose stop always fails, as if closing a session threw (REVIEW MCP-A Fixes S-2).
function build() {
  const lines: Array<Record<string, unknown>> = []
  const http = {
    start: async () => undefined,
    stop: async () => {
      throw new Error('made-up stop failure')
    },
    running: () => true,
    address: () => null,
  } as unknown as McpHttp
  const settings = {
    get: () => ({ mcp: { enabled: true, port: 47900 } }),
    setMcpEnabled: () => undefined,
  } as unknown as SettingsStore
  const secrets = { get: () => 'made-up-local-token-for-tests-only', set: () => undefined }
  const log = { write: (line: Record<string, unknown>) => void lines.push(line) }
  const service = createMcpService({
    http,
    settings,
    secrets: secrets as unknown as SecretStore,
    log: log as unknown as ActivityLog,
  })
  return { service, lines }
}

describe('a port change never throws out of settings.update [S-2; SPEC 14 1.58 J-7]', () => {
  it('resolves and logs a warning when stopping the old listener fails', async () => {
    const { service, lines } = build()
    await expect(service.portChanged()).resolves.toBeUndefined()
    expect(lines).toMatchObject([{ level: 'warn', event: 'mcp', name: 'mcp.restart', ok: false }])
  })
})
