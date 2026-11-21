import { describe, it, expect, vi, afterEach } from 'vitest'
import { connectError, freePort } from '../../../integration/mcp/http-client'

// Sessions whose close always fails, to show the listener still closes (REVIEW MCP-A
// Fixes S-1).
vi.mock('@/main/mcp/sessions', () => ({
  createSessions: () => ({
    handle: async () => undefined,
    closeAll: async () => {
      throw new Error('made-up session close failure')
    },
  }),
}))

const { createMcpHttp } = await import('@/main/mcp/server')
const caller = { execute: vi.fn(), query: vi.fn() }
const TOKEN = 'made-up-local-token-for-tests-only'

let server: ReturnType<typeof createMcpHttp> | undefined
afterEach(async () => {
  await server?.stop().catch(() => undefined)
  server = undefined
})

describe('stopping the server when closing a session fails [S-1; SPEC 5.1 step 4]', () => {
  it('still closes the listener, so the port is free for the next start', async () => {
    server = createMcpHttp({ caller, appVersion: '0.1.0' })
    const port = await freePort()
    await server.start({ port, token: TOKEN })

    await server.stop().catch(() => undefined)

    expect(server.running()).toBe(false)
    expect(await connectError('127.0.0.1', port)).toBe('ECONNREFUSED')
    await server.start({ port, token: TOKEN })
    expect(server.running()).toBe(true)
  })
})
