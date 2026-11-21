import net from 'node:net'
import { describe, it, expect, afterEach } from 'vitest'
import { data } from '../core-fixture'
import { makeMcpFixture, stopAndClean, type McpFixture } from '../mcp/mcp-fixture'
import { connectError, freePort, INIT, mcpHeaders, openSession, send } from '../mcp/http-client'
import type { ConnectInfo } from '@/shared/schemas/queries/mcp'

let f: McpFixture | undefined
let blocker: net.Server | undefined
afterEach(async () => {
  await stopAndClean(f)
  await new Promise((r) => (blocker ? blocker.close(r) : r(null)))
  f = blocker = undefined
})

const state = async (fx: McpFixture) => {
  const all = data<ConnectInfo>(await fx.core.query('mcp.getConnectInfo', {}, { actor: 'user' }))
  return { enabled: all.enabled, running: all.running, problem: all.problem, port: all.port }
}

describe('settings.update changes mcp.port while the server is on [SPEC 14 1.58 J-7]', () => {
  it('closes the old listener and listens on the new port', async () => {
    f = await makeMcpFixture()
    data(await f.user('mcp.setEnabled', { enabled: true }))
    const token = await f.token()
    await openSession(f.port, token)
    const next = await freePort()

    data(await f.user('settings.update', { mcp: { port: next } }))

    expect(await connectError('127.0.0.1', f.port)).toBe('ECONNREFUSED')
    const reply = await send({ port: next, headers: mcpHeaders(next, token), body: INIT })
    expect(reply.status).toBe(200)
    expect(await state(f)).toEqual({ enabled: true, running: true, problem: null, port: next })
  })

  it('a taken new port is still saved: the setting stays on and the problem is port_in_use', async () => {
    f = await makeMcpFixture()
    data(await f.user('mcp.setEnabled', { enabled: true }))
    const next = await freePort()
    blocker = net.createServer()
    await new Promise<void>((r) => blocker?.listen(next, '127.0.0.1', r))

    expect(await f.user('settings.update', { mcp: { port: next } })).toMatchObject({ ok: true })

    expect(await connectError('127.0.0.1', f.port)).toBe('ECONNREFUSED')
    expect(await state(f)).toEqual({
      enabled: true,
      running: false,
      problem: 'port_in_use',
      port: next,
    })
  })

  it('with the server off, a port change starts nothing', async () => {
    f = await makeMcpFixture()
    const next = await freePort()
    data(await f.user('settings.update', { mcp: { port: next } }))
    expect(f.core.mcp.running()).toBe(false)
    expect(await connectError('127.0.0.1', next)).toBe('ECONNREFUSED')
  })
})
