import http from 'node:http'
import net from 'node:net'
import os from 'node:os'
import { z } from 'zod'
import { describe, it, expect, afterEach } from 'vitest'
import { createMcpHttp, McpPortInUse, type McpHttp } from '../../../src/main/mcp/server'
import { agentCaller } from '../../../src/main/mcp/agent-caller'
import { ok } from '../../../src/shared/schemas/result'
import * as c from './http-client'

const TOKEN = 'made-up-local-token-for-tests-only'
const OTHER = 'made-up-second-token-for-tests-only'

let server: McpHttp | undefined
let blocker: net.Server | undefined
afterEach(async () => {
  await server?.stop()
  await new Promise((r) => (blocker ? blocker.close(r) : r(null)))
  server = blocker = undefined
})

function build() {
  const calls: Array<{ name: string; opts: unknown }> = []
  const sessions: number[] = []
  const caller = agentCaller({
    execute: async (name, _input, opts) => (calls.push({ name, opts }), ok(null)),
    query: async (name, _input, opts) => (calls.push({ name, opts }), ok(null)),
  })
  server = createMcpHttp({
    caller,
    appVersion: '0.1.0',
    tools: (mcp, agent) => {
      sessions.push(1)
      mcp.registerTool('probe', { inputSchema: { actor: z.string().optional() } }, async (a) => {
        await agent.execute('probe.command', a)
        return { content: [{ type: 'text', text: 'done' }] }
      })
    },
  })
  return { server, calls, sessions }
}

describe('the MCP listener [SPEC 6.8, 1.56 review point 1]', () => {
  it('binds 127.0.0.1 only: not ::1 and not this computer’s other addresses', async () => {
    const { server } = build()
    const port = await c.freePort()
    await server.start({ port, token: TOKEN })
    expect(server.address()).toEqual({ address: '127.0.0.1', family: 'IPv4', port })
    expect(await c.connectError('127.0.0.1', port)).toBeNull()
    expect(await c.connectError('::1', port)).not.toBeNull()
    const others = Object.values(os.networkInterfaces())
      .flat()
      .filter((a) => a && !a.internal && a.family === 'IPv4')
    for (const a of others) {
      expect(await c.connectError(a?.address ?? '', port), a?.address).not.toBeNull()
    }
  })

  it('refuses to start, and stays off, when the port is taken', async () => {
    const { server } = build()
    const port = await c.freePort()
    blocker = net.createServer()
    await new Promise<void>((r) => blocker?.listen(port, '127.0.0.1', r))
    await expect(server.start({ port, token: TOKEN })).rejects.toBeInstanceOf(McpPortInUse)
    expect(server.running()).toBe(false)
  })
})

describe('the checks before any command [SPEC 5.1, 6.8, 1.56 review points 2 and 3]', () => {
  it('answers a missing or wrong token with 401 and reaches no session or command', async () => {
    const { server, calls, sessions } = build()
    const port = await c.freePort()
    await server.start({ port, token: TOKEN })
    const call = { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'probe' } }
    for (const auth of [undefined, 'Bearer made-up-wrong-token', TOKEN]) {
      const headers = { ...c.mcpHeaders(port, TOKEN), authorization: auth }
      for (const body of [c.INIT, call]) {
        const reply = await c.send({ port, headers, body })
        expect(reply.status).toBe(401)
        expect(reply.headers['mcp-session-id']).toBeUndefined()
      }
    }
    expect(sessions).toEqual([])
    expect(calls).toEqual([])
  })

  it('refuses any Origin and a wrong Host with 403, even with the right token', async () => {
    const { server, sessions } = build()
    const port = await c.freePort()
    await server.start({ port, token: TOKEN })
    const extras: Record<string, string>[] = [
      { origin: 'https://made-up-page.example' },
      { origin: `http://127.0.0.1:${port}` },
      { host: `made-up-rebind.example:${port}` },
      { host: `127.0.0.1:${port + 1}` },
    ]
    for (const extra of extras) {
      const reply = await c.send({ port, headers: c.mcpHeaders(port, TOKEN, extra), body: c.INIT })
      expect(reply.status, JSON.stringify(extra)).toBe(403)
    }
    expect(sessions).toEqual([])
  })

  it('opens a session for both allowed Host values with the right token', async () => {
    const { server, sessions } = build()
    const port = await c.freePort()
    await server.start({ port, token: TOKEN })
    for (const host of [`127.0.0.1:${port}`, `localhost:${port}`]) {
      const reply = await c.send({
        port,
        headers: c.mcpHeaders(port, TOKEN, { host }),
        body: c.INIT,
      })
      expect(reply.status).toBe(200)
      expect(c.message(reply)).toMatchObject({ id: 1, result: { serverInfo: { name: 'adman' } } })
    }
    expect(sessions).toHaveLength(2)
  })
})

describe('the actor [SPEC 4.1, 1.56 review point 5]', () => {
  it('is agent for a tool call, whatever the headers and arguments say', async () => {
    const { server, calls } = build()
    const port = await c.freePort()
    await server.start({ port, token: TOKEN })
    const id = await c.openSession(port, TOKEN)
    const headers = { ...c.sessionHeaders(port, TOKEN, id), 'x-adman-actor': 'user' }
    const params = { name: 'probe', arguments: { actor: 'user' }, _meta: { actor: 'user' } }
    const body = { jsonrpc: '2.0', id: 2, method: 'tools/call', params }
    const reply = await c.send({ port, headers, body })
    expect(c.message(reply)).toMatchObject({ result: { content: [{ text: 'done' }] } })
    expect(calls).toEqual([{ name: 'probe.command', opts: { actor: 'agent' } }])
  })
})

describe('stopping the server [SPEC 5.1 step 4, 5.3, 1.56 review point 6]', () => {
  it('closes the listener, ends an open stream and forgets every session', async () => {
    const { server } = build()
    const port = await c.freePort()
    await server.start({ port, token: TOKEN })
    const id = await c.openSession(port, TOKEN)
    const ended = new Promise<void>((resolve) => {
      const req = http.request(
        { host: '127.0.0.1', port, method: 'GET', path: '/mcp', setHost: false },
        (res) => (res.resume(), res.on('close', () => resolve())),
      )
      for (const [k, v] of Object.entries(c.sessionHeaders(port, TOKEN, id))) req.setHeader(k, v)
      req.setHeader('accept', 'text/event-stream')
      req.on('error', () => resolve())
      req.end()
    })
    await new Promise((r) => setTimeout(r, 50))
    await server.stop()
    await ended
    expect(server.running()).toBe(false)
    expect(await c.connectError('127.0.0.1', port)).toBe('ECONNREFUSED')

    await server.start({ port, token: OTHER })
    const reply = await c.send({ port, headers: c.sessionHeaders(port, OTHER, id), body: c.INIT })
    expect(reply.status).toBe(404)
    const old = await c.send({ port, headers: c.mcpHeaders(port, TOKEN), body: c.INIT })
    expect(old.status).toBe(401)
  })

  it('answers a path other than /mcp with 404', async () => {
    const { server } = build()
    const port = await c.freePort()
    await server.start({ port, token: TOKEN })
    const reply = await c.send({ port, headers: c.mcpHeaders(port, TOKEN), path: '/other' })
    expect(reply.status).toBe(404)
  })
})
