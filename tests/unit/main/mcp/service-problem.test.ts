import { describe, it, expect } from 'vitest'
import { createMcpService } from '../../../../src/main/mcp/service'
import type { McpHttp } from '../../../../src/main/mcp/server'
import type { SettingsStore } from '../../../../src/main/settings/settings-store'
import type { SecretStore } from '../../../../src/main/secrets/secret-store'
import type { ActivityLog } from '../../../../src/main/log/activity-log'

const TOKEN = 'made-up-local-token-for-tests-only'

// An HTTP door whose start fails for a reason other than a taken port.
function build(enabled: boolean) {
  const lines: string[] = []
  const http = {
    start: async () => {
      throw new Error('made-up start failure')
    },
    stop: async () => undefined,
    running: () => false,
    address: () => null,
  } as unknown as McpHttp
  const state = { enabled }
  const settings = {
    get: () => ({ mcp: { enabled: state.enabled, port: 47900 } }),
    setMcpEnabled: (on: boolean) => void (state.enabled = on),
  } as unknown as SettingsStore
  const secrets = { get: () => TOKEN, set: () => undefined } as unknown as SecretStore
  const log = { write: (l: unknown) => void lines.push(JSON.stringify(l)) }
  const service = createMcpService({ http, settings, secrets, log: log as unknown as ActivityLog })
  return { service, lines, state }
}

describe('problem start_failed [SPEC 14 1.59 L-10]', () => {
  it('is start_failed after a failed start at app start while the setting is on', async () => {
    const { service, lines } = build(true)
    await service.startIfEnabled()
    expect(service.problem()).toBe('start_failed')
    expect(lines.some((l) => l.includes(TOKEN))).toBe(false)
  })

  it('is start_failed after a failed restart on a port change', async () => {
    const { service } = build(true)
    await service.portChanged()
    expect(service.problem()).toBe('start_failed')
  })

  it('stays null while the setting is off', async () => {
    const { service, state } = build(true)
    await service.startIfEnabled()
    state.enabled = false
    expect(service.problem()).toBeNull()
  })

  it('stays null when the user turns it on and the start fails: the setting stays off', async () => {
    const { service } = build(false)
    await expect(service.setEnabled(true)).rejects.toThrow()
    expect(service.problem()).toBeNull()
  })
})
