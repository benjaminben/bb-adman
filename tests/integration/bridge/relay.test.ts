// P10-9 (spec/phases/phase-10.md, "Bridge", A-244): the relay between a client on stdio and
// the app's real MCP server. In process: a client on a stream pair, through the relay, to the
// server of a core fixture. Token checks compare with a boolean, so a failure never prints it.
import { describe, it, expect, afterEach } from 'vitest'
import http from 'node:http'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { makeMcpFixture, stopAndClean, type McpFixture } from '../mcp/mcp-fixture'
import { freePort } from '../mcp/http-client'
import { toolSession } from '../mcp/tool-client'
import { data } from '../core-fixture'
import { streamPair, request, type StreamPair } from './stream-pair'
import { bridgeDoor, runRelay, type BridgeDoor } from '@/main/bridge/relay'
import { CLOSED_MESSAGE } from '@/main/bridge/closed-answer'

let f: McpFixture | undefined
let pair: StreamPair | undefined
const servers: http.Server[] = []
afterEach(async () => {
  pair?.input.end()
  pair = undefined
  await stopAndClean(f)
  f = undefined
  for (const s of servers.splice(0)) await new Promise((r) => s.close(r))
})

const closed = (id: number) => ({
  jsonrpc: '2.0',
  id,
  error: { code: -32000, message: CLOSED_MESSAGE },
})

function relay(door: BridgeDoor) {
  pair = streamPair()
  const done = runRelay({ input: pair.input, output: pair.output, door })
  return { pair, done }
}

async function serverOn(): Promise<{ port: number; token: string }> {
  f = await makeMcpFixture()
  data(await f.user('mcp.setEnabled', { enabled: true }))
  return { port: f.port, token: await f.token() }
}

describe('the bridge relay [P10-9, A-244]', () => {
  it('relays to the real server: the same tools as the HTTP door, and list_projects', async () => {
    const door = await serverOn()
    const { pair } = relay(door)
    const client = new Client({ name: 'made-up-desktop', version: '0.0.0' })
    await client.connect(pair.transport())
    const listed = await client.listTools()
    const direct = await (await toolSession(door.port, door.token)).list()
    expect(listed.tools.map((t) => t.name)).toEqual(direct.map((t) => t.name))
    const reply = await client.callTool({ name: 'list_projects', arguments: {} })
    expect(reply.isError).toBeFalsy()
    expect(pair.written().includes(door.token)).toBe(false)
    // The server ran the call as an agent, and named the client it was told.
    const tool = f!
      .readLogs()
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l) as Record<string, unknown>)
      .filter((l) => l.event === 'tool')
    expect(tool).toEqual([
      expect.objectContaining({
        name: 'list_projects',
        actor: 'agent',
        agentClient: 'made-up-desktop',
      }),
    ])
    expect(f!.readLogs().includes(door.token)).toBe(false)
    await client.close()
  })

  it('answers every request with the closed answer when the token is wrong', async () => {
    const door = await serverOn()
    const { pair } = relay({ port: door.port, token: 'made-up-wrong-token' })
    pair.write(request(1, 'initialize', { protocolVersion: '2025-06-18', capabilities: {} }))
    expect(await pair.next()).toEqual(closed(1))
    pair.write(request(2, 'tools/list'))
    expect(await pair.next()).toEqual(closed(2))
    expect(pair.written().includes(door.token)).toBe(false)
  })

  it('gives the closed answer when nothing listens on the port (the app is not running)', async () => {
    const { pair } = relay({ port: await freePort(), token: 'made-up-token' })
    pair.write(request(7, 'initialize'))
    expect(await pair.next()).toEqual(closed(7))
  })

  it('gives the closed answer while the setting is off or there is no token, and drops notifications', async () => {
    expect(bridgeDoor({ enabled: false, port: 47821 }, 'made-up-token')).toBeNull()
    expect(bridgeDoor({ enabled: true, port: 47821 }, null)).toBeNull()
    expect(bridgeDoor({ enabled: true, port: 47821 }, 'made-up-token')).toEqual({
      port: 47821,
      token: 'made-up-token',
    })
    const { pair } = relay(null)
    pair.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`)
    pair.write(request(3, 'tools/call', { name: 'list_projects', arguments: {} }))
    // The notification gave nothing: the first thing written is the request's answer.
    expect(await pair.next()).toEqual(closed(3))
  })

  it('drops a line that is not MCP without echoing it, and answers the next request', async () => {
    const { pair } = relay(null)
    pair.write('{"jsonrpc":"2.0","id":1,"method":"made-up-secret-word"\n')
    pair.write('not json made-up-secret-word\n')
    pair.write(request(4, 'tools/list'))
    expect(await pair.next()).toEqual(closed(4))
    // Only the one answer came back; neither bad line was echoed.
    expect(pair.wrote()).toBe(`${JSON.stringify(closed(4))}\n`)
  })

  it('ends when a message passes the size limit, and when its input ends', async () => {
    const big = relay(null)
    big.pair.write(`{"jsonrpc":"2.0","id":1,"method":"${'x'.repeat(5 * 1024 * 1024)}`)
    await big.done
    const small = relay(null)
    small.pair.input.end()
    await small.done
  })

  it('follows no redirect, even to its own address: a 307 gives the closed answer', async () => {
    const hits: string[] = []
    const server = http.createServer((req, res) => {
      if (req.url === '/mcp') return void res.writeHead(307, { location: '/moved' }).end()
      hits.push(req.url ?? '')
      res.end()
    })
    servers.push(server)
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
    const port = (server.address() as { port: number }).port
    const { pair } = relay({ port, token: 'made-up-token' })
    pair.write(request(5, 'initialize'))
    expect(await pair.next()).toEqual(closed(5))
    expect(hits).toEqual([])
  })
})
