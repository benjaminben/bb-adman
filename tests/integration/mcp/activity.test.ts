// P10-8 (spec/phases/phase-10.md, A-241, A-242): every tool call writes one `event: 'tool'` log
// line and sends one agent.activity event, on success and on refusal. The window gets the tool
// name, the project ID, ok and the time only: never an argument, a reply, a path or the
// request ID. The tool name is the table's, never the agent's text. The cleaned client name
// reaches the bus's command line (security class short).
import { afterEach, describe, expect, it, vi } from 'vitest'
import { data } from '../core-fixture'
import * as c from './http-client'
import { askSetUp, type AskSetUp } from './ask-fixture'
import type { ToolReply } from './tool-client'

let x: AskSetUp | undefined
afterEach(async () => {
  await x?.close()
  x = undefined
})

type Line = Record<string, unknown>
type Call = (name: string, args: unknown, id?: string) => Promise<ToolReply>

const RAW_CLIENT = '\u202eSneaky "Client"\n\u200b  of \u00a0 the week'
const CLEAN_CLIENT = "Sneaky 'Client' of the week"
const REQUEST_ID = 'req-Quince-7781'

// A session whose initialize names the client RAW_CLIENT, so the cleaner has work to do.
async function session(s: AskSetUp): Promise<Call> {
  data(await s.user('settings.update', { mcp: { port: await c.freePort() } }))
  data(await s.user('mcp.setEnabled', { enabled: true }))
  const port = s.core.settings.get().mcp.port
  const token = s.core.secrets.get('mcp.token') ?? ''
  const init = {
    ...c.INIT,
    params: { ...c.INIT.params, clientInfo: { name: RAW_CLIENT, version: '1' } },
  }
  const reply = await c.send({ port, headers: c.mcpHeaders(port, token), body: init })
  const sid = String(reply.headers['mcp-session-id'])
  const extra = { 'mcp-session-id': sid, 'mcp-protocol-version': c.INIT.params.protocolVersion }
  const headers = c.mcpHeaders(port, token, extra)
  await c.send({ port, headers, body: { jsonrpc: '2.0', method: 'notifications/initialized' } })
  return async (name, args, id = REQUEST_ID) => {
    const body = { jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args } }
    const msg = c.message(await c.send({ port, headers, body })) as { result?: ToolReply }
    return msg.result ?? { isError: true }
  }
}

const lines = (s: AskSetUp): Line[] =>
  s
    .readLogs()
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Line)

const toolLines = (s: AskSetUp) => lines(s).filter((l) => l.event === 'tool')
const activity = (s: AskSetUp) =>
  s.events.flatMap((e) => (e.name === 'agent.activity' ? [e.payload] : []))

// Everything this slice writes or sends for a call, as one text.
const written = (s: AskSetUp) => JSON.stringify([toolLines(s), activity(s)])

describe('agent activity over MCP [P10-8; A-241]', () => {
  it('a call that works writes one tool line and sends one event, with no reply value', async () => {
    x = await askSetUp()
    const call = await session(x)
    const reply = await call('get_project', { project_id: x.projectId })
    expect(reply.isError).toBeFalsy()
    expect(JSON.stringify(reply)).toContain('Spring Work')
    expect(toolLines(x)).toEqual([
      expect.objectContaining({
        level: 'info',
        event: 'tool',
        name: 'get_project',
        actor: 'agent',
        agentClient: CLEAN_CLIENT,
        projectId: x.projectId,
        campaignId: null,
        variantId: null,
        jobId: null,
        ok: true,
        errorKind: null,
        message: 'tool call',
        context: {},
      }),
    ])
    const at = toolLines(x)[0]?.timestamp
    expect(activity(x)).toEqual([{ tool: 'get_project', projectId: x.projectId, ok: true, at }])
    for (const word of ['Spring Work', 'Summer Splash', REQUEST_ID]) {
      expect(written(x)).not.toContain(word)
    }
  })

  it('a refused call writes one line and one event with its error kind and no argument', async () => {
    x = await askSetUp()
    const call = await session(x)
    const reply = await call('get_campaign', {
      project_id: x.projectId,
      campaign_id: 'Plum-Argument-Value-42',
    })
    expect(reply.isError).toBe(true)
    expect(toolLines(x)).toEqual([
      expect.objectContaining({ name: 'get_campaign', ok: false, errorKind: 'NOT_FOUND' }),
    ])
    expect(activity(x)).toEqual([
      { tool: 'get_campaign', projectId: x.projectId, ok: false, at: expect.any(String) },
    ])
    expect(written(x)).not.toContain('Plum-Argument')
    expect(written(x)).not.toContain(REQUEST_ID)
  })

  it.each([
    ['a path', '/Users/made-up/Documents/secret plan.adman'],
    ['markup', '<img src=x onerror=alert(1)>'],
    ['a long text', 'Q'.repeat(5000)],
  ])('gives a null project ID, not the agent text, for %s', async (_case, projectId) => {
    x = await askSetUp()
    const call = await session(x)
    await call('get_project', { project_id: projectId })
    expect(toolLines(x)).toEqual([expect.objectContaining({ projectId: null, ok: false })])
    expect(activity(x)).toEqual([expect.objectContaining({ projectId: null, ok: false })])
    expect(written(x)).not.toContain(projectId.slice(0, 12))
  })

  it('an unknown tool name is never written or sent', async () => {
    x = await askSetUp()
    const call = await session(x)
    const name = 'steal_<b>Fig-Files</b>'
    const reply = await call(name, { project_id: x.projectId })
    expect(reply.isError).toBe(true)
    expect(toolLines(x)).toEqual([])
    expect(activity(x)).toEqual([])
    expect(x.readLogs()).not.toContain('Fig-Files')
    expect(JSON.stringify(x.events)).not.toContain('Fig-Files')
  })

  it("the bus's command line and the ask line carry the cleaned client name", async () => {
    x = await askSetUp()
    data(await x.user('settings.update', { mcp: { autoApproveDestructive: true } }))
    const call = await session(x)
    const reply = await call('delete_campaign', {
      project_id: x.projectId,
      campaign_id: x.campaignId,
    })
    expect(reply.isError).toBeFalsy()
    const byEvent = (event: string) =>
      lines(x!).filter((l) => l.event === event && l.name === 'campaign.delete')
    expect(byEvent('command')).toEqual([
      expect.objectContaining({ actor: 'agent', agentClient: CLEAN_CLIENT, ok: true }),
    ])
    expect(byEvent('ask')).toEqual([expect.objectContaining({ agentClient: CLEAN_CLIENT })])
    expect(toolLines(x)).toEqual([
      expect.objectContaining({ name: 'delete_campaign', agentClient: CLEAN_CLIENT, ok: true }),
    ])
    expect(activity(x)).toEqual([
      { tool: 'delete_campaign', projectId: x.projectId, ok: true, at: expect.any(String) },
    ])
    expect(written(x)).not.toContain(x.campaignId)
    expect(x.readLogs()).not.toContain('Sneaky "Client"')
  })

  // P10-7b: a handler that throws is still recorded, as INTERNAL, with none of the error's text.
  it('a call whose handler throws writes one line and one event, with no error text', async () => {
    x = await askSetUp()
    const call = await session(x)
    const execute = x.core.bus.execute.bind(x.core.bus)
    vi.spyOn(x.core.bus, 'execute').mockImplementation((name, input, opts) =>
      opts.actor === 'agent'
        ? Promise.reject(new Error('Thrown-Words at /Users/made-up/secret.adman'))
        : execute(name, input, opts),
    )
    const reply = await call('delete_campaign', {
      project_id: x.projectId,
      campaign_id: x.campaignId,
    })
    expect(reply.isError).toBe(true)
    expect(toolLines(x)).toEqual([
      expect.objectContaining({
        name: 'delete_campaign',
        agentClient: CLEAN_CLIENT,
        projectId: x.projectId,
        ok: false,
        errorKind: 'INTERNAL',
      }),
    ])
    expect(activity(x)).toEqual([
      { tool: 'delete_campaign', projectId: x.projectId, ok: false, at: expect.any(String) },
    ])
    for (const word of ['Thrown-Words', 'secret.adman', x.campaignId, REQUEST_ID]) {
      expect(written(x)).not.toContain(word)
    }
  })
})
