import { describe, it, expect, afterEach } from 'vitest'
import { data } from '../core-fixture'
import { makeMcpFixture, stopAndClean, type McpFixture } from '../mcp/mcp-fixture'
import { INIT, mcpHeaders, openSession, send, sessionHeaders } from '../mcp/http-client'

let f: McpFixture | undefined
afterEach(async () => {
  await stopAndClean(f)
  f = undefined
})

describe('mcp.regenerateToken [SPEC 4.2, 5.1 step 4, 1.56 review point 6]', () => {
  it('replaces the token, refuses the old one and drops open sessions', async () => {
    f = await makeMcpFixture()
    data(await f.user('mcp.setEnabled', { enabled: true }))
    const before = await f.token()
    const session = await openSession(f.port, before)

    expect(await f.user('mcp.regenerateToken', {})).toEqual({ ok: true, data: {} })
    const after = await f.token()
    expect(after === before).toBe(false)
    expect(Buffer.from(after, 'base64url')).toHaveLength(32)
    expect(f.core.mcp.running()).toBe(true)

    const port = f.port
    const old = await send({ port, headers: mcpHeaders(port, before), body: INIT })
    expect(old.status).toBe(401)
    const dropped = await send({ port, headers: sessionHeaders(port, after, session), body: INIT })
    expect(dropped.status).toBe(404)
    const fresh = await send({ port, headers: mcpHeaders(port, after), body: INIT })
    expect(fresh.status).toBe(200)
  })

  it('with the server off, makes a token and still listens nowhere', async () => {
    f = await makeMcpFixture()
    data(await f.user('mcp.regenerateToken', {}))
    expect(f.core.secrets.summaries().map((s) => s.name)).toContain('mcp.token')
    expect(f.core.mcp.running()).toBe(false)
    expect(f.core.settings.get().mcp.enabled).toBe(false)
  })

  it('is refused for an agent, and the token is unchanged [SPEC 4.2: deny]', async () => {
    f = await makeMcpFixture()
    data(await f.user('mcp.setEnabled', { enabled: true }))
    const before = await f.token()
    expect(await f.agent('mcp.regenerateToken', {})).toMatchObject({
      ok: false,
      error: { code: 'AGENT_DENIED' },
    })
    expect((await f.token()) === before).toBe(true)
  })
})

describe('mcp operations run one at a time [SPEC 14 1.56 review point 6; REVIEW MCP-A R-1]', () => {
  it('a new token sent while a start is in progress: the old token gets 401, the new one works', async () => {
    f = await makeMcpFixture()
    data(await f.user('mcp.setEnabled', { enabled: true }))
    data(await f.user('mcp.setEnabled', { enabled: false }))
    const before = await f.token()

    const on = f.user('mcp.setEnabled', { enabled: true })
    const regen = f.user('mcp.regenerateToken', {})
    data(await on)
    data(await regen)

    const after = await f.token()
    expect(after === before).toBe(false)
    const port = f.port
    const old = await send({ port, headers: mcpHeaders(port, before), body: INIT })
    expect(old.status).toBe(401)
    const fresh = await send({ port, headers: mcpHeaders(port, after), body: INIT })
    expect(fresh.status).toBe(200)
  })
})

describe('mcp.regenerateToken with the setting on and no token [SPEC 14 1.58 J-11]', () => {
  it('makes a token and starts the server', async () => {
    f = await makeMcpFixture()
    data(await f.user('mcp.setEnabled', { enabled: true }))
    await f.core.mcp.stop()
    f.core.secrets.delete('mcp.token')
    f.restart()
    await f.core.mcp.startIfEnabled()
    expect(f.core.mcp.running()).toBe(false)

    data(await f.user('mcp.regenerateToken', {}))
    expect(f.core.mcp.running()).toBe(true)
    const token = await f.token()
    const reply = await send({ port: f.port, headers: mcpHeaders(f.port, token), body: INIT })
    expect(reply.status).toBe(200)
  })
})
