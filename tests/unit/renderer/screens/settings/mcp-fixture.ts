// Made-up mcp.getConnectInfo data for the Settings agent access tests. The token is a
// placeholder that does not look like a real key.
import type { ConnectInfo } from '@/shared/schemas/queries/mcp'
import type { Result } from '@/shared/schemas/result'
import { makeFakeApi } from '../../fake-api'

export const TOKEN = 'made-up-test-token-not-a-key'
export const PORT = 47821

export function line(port = PORT, token = TOKEN): string {
  return `claude mcp add --transport http adman http://127.0.0.1:${port}/mcp --header "Authorization: Bearer ${token}"`
}

export function connect(overrides: Partial<ConnectInfo> = {}): ConnectInfo {
  return {
    enabled: true,
    running: true,
    problem: null,
    address: `http://127.0.0.1:${PORT}/mcp`,
    port: PORT,
    token: TOKEN,
    claudeCode: line(),
    ...overrides,
  }
}

export const OFF = connect({ enabled: false, running: false })

export function refused(message: string, reason?: string): Result<unknown> {
  return {
    ok: false,
    error: {
      code: reason ? 'RULE_VIOLATION' : 'INVALID_INPUT',
      message,
      ...(reason ? { details: { reason } } : {}),
    },
  }
}

export function mcpFake(start: ConnectInfo = OFF) {
  const fake = makeFakeApi()
  let current = start
  fake.onQuery('mcp.getConnectInfo', () => ({ ok: true, data: current }))
  return {
    fake,
    setInfo: (next: ConnectInfo) => (current = next),
    reads: () => fake.queries.filter((q) => q.name === 'mcp.getConnectInfo').length,
  }
}
