import net from 'node:net'
import { describe, it, expect, afterEach } from 'vitest'
import { data } from '../core-fixture'
import { makeMcpFixture, stopAndClean, type McpFixture } from '../mcp/mcp-fixture'
import type { ConnectInfo } from '@/shared/schemas/queries/mcp'

let f: McpFixture | undefined
let blocker: net.Server | undefined
afterEach(async () => {
  await stopAndClean(f)
  await new Promise((r) => (blocker ? blocker.close(r) : r(null)))
  f = blocker = undefined
})

const asUser = { actor: 'user' as const }
// Only the state fields, so a failing assertion can never print the token.
const info = async (fx: McpFixture) => {
  const all = data<ConnectInfo>(await fx.core.query('mcp.getConnectInfo', {}, asUser))
  const { enabled, running, problem } = all
  const token = all.token && 'set'
  return { enabled, running, problem, token, claudeCode: all.claudeCode && 'set' }
}

// Turns the setting on, then stops the server, ready for a rebuilt core (the next app start).
async function onThenStop(fx: McpFixture): Promise<void> {
  data(await fx.user('mcp.setEnabled', { enabled: true }))
  await fx.core.mcp.stop()
}

describe('mcp.getConnectInfo running and problem [SPEC 14 1.58 J-8, J-11]', () => {
  it('says running with no problem while the server listens', async () => {
    f = await makeMcpFixture()
    data(await f.user('mcp.setEnabled', { enabled: true }))
    expect(await info(f)).toMatchObject({ enabled: true, running: true, problem: null })
  })

  it('with the setting on and no token: not running, token_missing, no token', async () => {
    f = await makeMcpFixture()
    await onThenStop(f)
    f.core.secrets.delete('mcp.token')
    f.restart()
    await f.core.mcp.startIfEnabled()
    expect(await info(f)).toMatchObject({
      enabled: true,
      running: false,
      problem: 'token_missing',
      token: null,
      claudeCode: null,
    })
    expect(f.core.secrets.summaries().map((s) => s.name)).not.toContain('mcp.token')
  })

  it('with the port taken at start-up: setting still on, not running, port_in_use', async () => {
    f = await makeMcpFixture()
    await onThenStop(f)
    blocker = net.createServer()
    await new Promise<void>((r) => blocker?.listen(f?.port, '127.0.0.1', r))
    f.restart()
    await f.core.mcp.startIfEnabled()
    expect(await info(f)).toMatchObject({ enabled: true, running: false, problem: 'port_in_use' })
  })

  it('a new token with the port taken keeps the setting on and reports port_in_use', async () => {
    f = await makeMcpFixture()
    await onThenStop(f)
    blocker = net.createServer()
    await new Promise<void>((r) => blocker?.listen(f?.port, '127.0.0.1', r))
    f.restart()
    expect(await f.user('mcp.regenerateToken', {})).toMatchObject({
      ok: false,
      error: { code: 'RULE_VIOLATION', details: { reason: 'port_in_use' } },
    })
    expect(f.core.settings.get().mcp.enabled).toBe(true)
    expect(await info(f)).toMatchObject({ running: false, problem: 'port_in_use' })
  })

  it('with the setting off: not running and no problem', async () => {
    f = await makeMcpFixture()
    data(await f.user('mcp.setEnabled', { enabled: true }))
    data(await f.user('mcp.setEnabled', { enabled: false }))
    expect(await info(f)).toMatchObject({ enabled: false, running: false, problem: null })
  })
})
