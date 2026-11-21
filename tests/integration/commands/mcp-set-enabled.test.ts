import net from 'node:net'
import { describe, it, expect, afterEach } from 'vitest'
import { fakeCrypto, data } from '../core-fixture'
import { makeMcpFixture, stopAndClean, type McpFixture } from '../mcp/mcp-fixture'
import { connectError, INIT, mcpHeaders, send } from '../mcp/http-client'

let f: McpFixture | undefined
let blocker: net.Server | undefined
afterEach(async () => {
  await stopAndClean(f)
  await new Promise((r) => (blocker ? blocker.close(r) : r(null)))
  f = blocker = undefined
})

const secretNames = (fx: McpFixture) => fx.core.secrets.summaries().map((s) => s.name)

describe('off by default [SPEC 6.8, FR-191]', () => {
  it('listens nowhere on first run, and start-up with the setting off starts nothing', async () => {
    f = await makeMcpFixture()
    expect(f.core.settings.get().mcp.enabled).toBe(false)
    await f.core.mcp.startIfEnabled()
    expect(f.core.mcp.running()).toBe(false)
    expect(await connectError('127.0.0.1', f.port)).toBe('ECONNREFUSED')
    expect(secretNames(f)).not.toContain('mcp.token')
  })
})

describe('mcp.setEnabled [SPEC 4.2, 5.1, 6.8]', () => {
  it('on: makes a token if none exists, saves the setting and listens on 127.0.0.1:{port}', async () => {
    f = await makeMcpFixture()
    expect(await f.user('mcp.setEnabled', { enabled: true })).toEqual({
      ok: true,
      data: { enabled: true },
    })
    expect(f.core.settings.get().mcp.enabled).toBe(true)
    expect(f.core.mcp.address()).toMatchObject({ address: '127.0.0.1', port: f.port })
    const token = await f.token()
    expect(Buffer.from(token, 'base64url')).toHaveLength(32)
    const reply = await send({ port: f.port, headers: mcpHeaders(f.port, token), body: INIT })
    expect(reply.status).toBe(200)
    expect(f.events.some((e) => e.name === 'app.stateChanged')).toBe(true)
  })

  it('keeps the same token when turned off and on again', async () => {
    f = await makeMcpFixture()
    data(await f.user('mcp.setEnabled', { enabled: true }))
    const first = await f.token()
    data(await f.user('mcp.setEnabled', { enabled: false }))
    data(await f.user('mcp.setEnabled', { enabled: true }))
    expect((await f.token()) === first).toBe(true)
  })

  it('off: saves the setting and closes the listener [1.56 review point 6]', async () => {
    f = await makeMcpFixture()
    data(await f.user('mcp.setEnabled', { enabled: true }))
    expect(await f.user('mcp.setEnabled', { enabled: false })).toEqual({
      ok: true,
      data: { enabled: false },
    })
    expect(f.core.settings.get().mcp.enabled).toBe(false)
    expect(f.core.mcp.running()).toBe(false)
    expect(await connectError('127.0.0.1', f.port)).toBe('ECONNREFUSED')
  })

  it('refuses a taken port with the 6.8 message; the server and the setting stay off', async () => {
    f = await makeMcpFixture()
    blocker = net.createServer()
    await new Promise<void>((r) => blocker?.listen(f?.port, '127.0.0.1', r))
    expect(await f.user('mcp.setEnabled', { enabled: true })).toEqual({
      ok: false,
      error: {
        code: 'RULE_VIOLATION',
        message: `Port ${f.port} is in use. Choose another.`,
        details: { reason: 'port_in_use' },
      },
    })
    expect(f.core.mcp.running()).toBe(false)
    expect(f.core.settings.get().mcp.enabled).toBe(false)
  })

  it('refuses when keys cannot be stored securely, and listens nowhere', async () => {
    f = await makeMcpFixture({ crypto: fakeCrypto(false) })
    expect(await f.user('mcp.setEnabled', { enabled: true })).toMatchObject({
      ok: false,
      error: { code: 'RULE_VIOLATION', details: { reason: 'secure_storage_unavailable' } },
    })
    expect(f.core.mcp.running()).toBe(false)
    expect(f.core.settings.get().mcp.enabled).toBe(false)
  })

  it('is refused for an agent, which changes nothing [SPEC 4.2: deny]', async () => {
    f = await makeMcpFixture()
    expect(await f.agent('mcp.setEnabled', { enabled: true })).toMatchObject({
      ok: false,
      error: { code: 'AGENT_DENIED' },
    })
    expect(f.core.mcp.running()).toBe(false)
    expect(f.core.settings.get().mcp.enabled).toBe(false)
    expect(secretNames(f)).not.toContain('mcp.token')
  })

  it('start-up with the setting on but no saved token stays off and logs a warning', async () => {
    f = await makeMcpFixture()
    data(await f.user('mcp.setEnabled', { enabled: true }))
    await f.core.mcp.stop()
    f.core.secrets.delete('mcp.token')
    f.restart()
    await f.core.mcp.startIfEnabled()
    expect(f.core.mcp.running()).toBe(false)
    expect(f.readLogs()).toContain('"name":"mcp.start"')
  })

  it('start-up with the setting on but the port taken stays off and logs the 6.8 message', async () => {
    f = await makeMcpFixture()
    data(await f.user('mcp.setEnabled', { enabled: true }))
    await f.core.mcp.stop()
    blocker = net.createServer()
    await new Promise<void>((r) => blocker?.listen(f?.port, '127.0.0.1', r))
    f.restart()
    await f.core.mcp.startIfEnabled()
    expect(f.core.mcp.running()).toBe(false)
    expect(f.readLogs()).toContain(`Port ${f.port} is in use. Choose another.`)
  })

  it('start-up with the setting on listens again with the saved token', async () => {
    f = await makeMcpFixture()
    data(await f.user('mcp.setEnabled', { enabled: true }))
    const token = await f.token()
    await f.core.mcp.stop()
    f.restart()
    await f.core.mcp.startIfEnabled()
    expect(f.core.mcp.running()).toBe(true)
    const reply = await send({ port: f.port, headers: mcpHeaders(f.port, token), body: INIT })
    expect(reply.status).toBe(200)
  })
})

describe('mcp.setEnabled runs one at a time [REVIEW MCP-A R-1]', () => {
  it('a fast off-then-on listens again, without "port in use"', async () => {
    f = await makeMcpFixture()
    data(await f.user('mcp.setEnabled', { enabled: true }))
    const token = await f.token()
    const off = f.user('mcp.setEnabled', { enabled: false })
    const on = f.user('mcp.setEnabled', { enabled: true })
    data(await off)
    data(await on)
    expect(f.core.mcp.running()).toBe(true)
    expect(f.core.settings.get().mcp.enabled).toBe(true)
    const reply = await send({ port: f.port, headers: mcpHeaders(f.port, token), body: INIT })
    expect(reply.status).toBe(200)
  })

  it('two overlapping "on" both succeed and leave one listener', async () => {
    f = await makeMcpFixture()
    const first = f.user('mcp.setEnabled', { enabled: true })
    const second = f.user('mcp.setEnabled', { enabled: true })
    data(await first)
    data(await second)
    expect(f.core.mcp.running()).toBe(true)
    const token = await f.token()
    const reply = await send({ port: f.port, headers: mcpHeaders(f.port, token), body: INIT })
    expect(reply.status).toBe(200)
  })
})

describe('start-up with the port taken keeps the setting on [SPEC 14 1.58 J-8]', () => {
  it('leaves settings.mcp.enabled true and the server off', async () => {
    f = await makeMcpFixture()
    data(await f.user('mcp.setEnabled', { enabled: true }))
    await f.core.mcp.stop()
    blocker = net.createServer()
    await new Promise<void>((r) => blocker?.listen(f?.port, '127.0.0.1', r))
    f.restart()
    await f.core.mcp.startIfEnabled()
    expect(f.core.mcp.running()).toBe(false)
    expect(f.core.settings.get().mcp.enabled).toBe(true)
  })
})
