import { describe, it, expect, afterEach } from 'vitest'
import { data } from '../core-fixture'
import { makeMcpFixture, stopAndClean, type McpFixture } from '../mcp/mcp-fixture'
import type { ConnectInfo } from '../../../src/shared/schemas/queries/mcp'

let f: McpFixture | undefined
afterEach(async () => {
  await stopAndClean(f)
  f = undefined
})

const asUser = { actor: 'user' as const }
const asAgent = { actor: 'agent' as const }

describe('mcp.getConnectInfo [SPEC 4.3, 6.8; FR-191, D-014]', () => {
  it('gives null for the token before one is made, and the address and port', async () => {
    f = await makeMcpFixture()
    const info = data<ConnectInfo>(await f.core.query('mcp.getConnectInfo', {}, asUser))
    expect(info).toEqual({
      enabled: false,
      running: false,
      problem: null,
      address: `http://127.0.0.1:${f.port}/mcp`,
      port: f.port,
      token: null,
      claudeCode: null,
    })
  })

  it('gives the user the full token and the Claude Code line of 6.8', async () => {
    f = await makeMcpFixture()
    data(await f.user('mcp.setEnabled', { enabled: true }))
    const token = await f.token()
    const info = data<ConnectInfo>(await f.core.query('mcp.getConnectInfo', {}, asUser))
    expect(info.enabled).toBe(true)
    expect(info.token === token).toBe(true)
    const line =
      `claude mcp add --transport http adman http://127.0.0.1:${f.port}/mcp` +
      ` --header "Authorization: Bearer ${token}"`
    expect(info.claudeCode === line).toBe(true)
  })
})

// The named test of SPEC 10.1 and 1.56 review point 7.
describe('mcp.getConnectInfo is refused for the agent actor, and it is the only query whose reply contains a secret value [SPEC 10.1; D-014]', () => {
  it('refuses the agent with AGENT_DENIED and a reply that holds no token', async () => {
    f = await makeMcpFixture()
    data(await f.user('mcp.setEnabled', { enabled: true }))
    const token = await f.token()
    const reply = await f.core.query('mcp.getConnectInfo', {}, asAgent)
    expect(reply).toMatchObject({ ok: false, error: { code: 'AGENT_DENIED' } })
    expect(JSON.stringify(reply).includes(token)).toBe(false)
    expect(JSON.stringify(reply).includes(String(f.port))).toBe(false)
  })

  it('no other query gives the token, to the user or the agent', async () => {
    f = await makeMcpFixture()
    data(await f.user('mcp.setEnabled', { enabled: true }))
    const token = await f.token()
    const created = data<{ projectId: string }>(
      await f.user('project.create', { name: 'Leak', location: f.projectsDir }),
    )
    const projectId = created.projectId
    const others: Array<[string, unknown]> = [
      ['app.getState', {}],
      ['comfy.getInfo', {}],
      ['project.get', { projectId }],
      ['asset.list', { projectId }],
      ['job.list', { projectId }],
    ]
    for (const [name, input] of others) {
      for (const opts of [asUser, asAgent]) {
        const reply = JSON.stringify(await f.core.query(name, input, opts))
        expect(reply.includes(token), `${name} as ${opts.actor}`).toBe(false)
      }
    }
    const own = JSON.stringify(await f.core.query('mcp.getConnectInfo', {}, asUser))
    expect(own.includes(token)).toBe(true)
  })

  // REVIEW MCP-A D-4: every query core registers, so a new one cannot be missed.
  it('no registered query but mcp.getConnectInfo for the user gives the token', async () => {
    f = await makeMcpFixture()
    data(await f.user('mcp.setEnabled', { enabled: true }))
    const token = await f.token()
    const created = data<{ projectId: string }>(
      await f.user('project.create', { name: 'Every', location: f.projectsDir }),
    )
    const names = f.core.queryNames
    expect(names).toContain('mcp.getConnectInfo')
    expect(names.length).toBeGreaterThan(5)
    const inputs = [{}, { projectId: created.projectId }]
    for (const name of names) {
      for (const input of inputs) {
        for (const opts of [asUser, asAgent]) {
          const reply = JSON.stringify(await f.core.query(name, input, opts))
          const mayHold = name === 'mcp.getConnectInfo' && opts.actor === 'user'
          if (!mayHold) expect(reply.includes(token), `${name} as ${opts.actor}`).toBe(false)
        }
      }
    }
  })
})
