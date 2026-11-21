// P10-1 (spec/phases/phase-10.md, "Design additions", A-230, A-241, A-242): what toolSetup does
// with the new ToolDef fields, over made-up rows, a fake server and a fake agent caller. A
// notBuilt row is never registered; a png row replies one image item and nothing else;
// prepareInput runs after the snake_case mapping and before the call; onCall sees every call
// with no input and no reply; the cleaned client name reaches execute.
import { describe, it, expect, vi } from 'vitest'
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { toolSetup, type ToolCall, type ToolDef } from '@/main/mcp/tools'
import { notBuilt } from '@/main/mcp/tools/not-built'
import type { AgentCaller } from '@/main/mcp/agent-caller'
import { INTERNAL_MESSAGE, type Result } from '@/shared/schemas/result'

// The cleaner is a stub (null) until P10-8; here it marks what it was given.
vi.mock('@/main/mcp/client-name', () => ({
  cleanClientName: (raw: unknown) => (typeof raw === 'string' ? `clean(${raw})` : null),
}))

type Reply = { content: Array<Record<string, unknown>>; isError?: boolean }
type Handler = (args: Record<string, unknown>) => Promise<Reply>

function session(setup: ReturnType<typeof toolSetup>, caller: AgentCaller, client?: string) {
  const handlers = new Map<string, Handler>()
  const server = {
    registerTool: (name: string, _cfg: unknown, handler: Handler) => {
      handlers.set(name, handler)
    },
    server: { getClientVersion: () => (client ? { name: client, version: '1.0.0' } : undefined) },
  }
  setup(server as unknown as McpServer, caller)
  return handlers
}

type Call = { name: string; input: unknown; agentClient?: string | null }

function fakeCaller(result: Result<unknown>, calls: Call[] = []): AgentCaller {
  return {
    execute: async (name, input, agentClient) => {
      calls.push({ name, input, agentClient })
      return result
    },
    query: async (name, input) => {
      calls.push({ name, input })
      return result
    },
  }
}

const PNG = new Uint8Array([137, 80, 78, 71, 1, 2, 3])

const ROWS: ToolDef[] = [
  {
    name: 'made_up_read',
    description: 'Made up.',
    kind: 'query',
    target: 'project.get',
    input: z.object({ projectId: z.string() }),
  },
  {
    name: 'made_up_picture',
    description: 'Made up.',
    kind: 'query',
    target: 'variant.render',
    input: z.object({ projectId: z.string(), variantId: z.string() }),
    content: 'png',
  },
  {
    name: 'made_up_write',
    description: 'Made up.',
    kind: 'command',
    target: 'layer.update',
    input: z.object({ projectId: z.string(), layerId: z.string() }),
    prepareInput: (input) => ({ ...input, filled: `from ${String(input.layerId)}` }),
  },
  notBuilt('made_up_later', 'command', 'campaign.delete'),
]

describe('toolSetup with the Phase 10 tool fields [P10-1]', () => {
  it('registers every row but a notBuilt one', () => {
    const handlers = session(toolSetup(ROWS), fakeCaller({ ok: true, data: {} }))
    expect([...handlers.keys()]).toEqual(['made_up_read', 'made_up_picture', 'made_up_write'])
  })

  it('makes a notBuilt row with an empty input, its target and the fixed description', () => {
    const row = notBuilt('made_up_later', 'query', 'subject.list')
    expect(row).toMatchObject({
      name: 'made_up_later',
      kind: 'query',
      target: 'subject.list',
      description: 'Not built yet.',
      notBuilt: true,
    })
    expect(Object.keys(row.input.shape)).toEqual([])
  })

  it('replies to a png row with one image item of data.png and nothing else', async () => {
    const data = { png: PNG, width: 4, height: 2, rev: 3, path: '/Users/made-up/a.png' }
    const handlers = session(toolSetup(ROWS), fakeCaller({ ok: true, data }))
    const reply = await handlers.get('made_up_picture')?.({ project_id: 'p1', variant_id: 'v1' })
    expect(reply).toEqual({
      content: [
        { type: 'image', data: Buffer.from(PNG).toString('base64'), mimeType: 'image/png' },
      ],
    })
  })

  it('replies to a refused png row with the error as text', async () => {
    const refusal = { ok: false as const, error: { code: 'NOT_FOUND' as const, message: 'No.' } }
    const handlers = session(toolSetup(ROWS), fakeCaller(refusal))
    const reply = await handlers.get('made_up_picture')?.({ project_id: 'p1', variant_id: 'v1' })
    expect(reply).toEqual({
      content: [{ type: 'text', text: JSON.stringify(refusal.error) }],
      isError: true,
    })
  })

  it('replies INTERNAL, with no data, to a png row whose reply holds no PNG bytes', async () => {
    const data = { png: '/Users/made-up/a.png', path: '/Users/made-up/a.png' }
    const handlers = session(toolSetup(ROWS), fakeCaller({ ok: true, data }))
    const reply = await handlers.get('made_up_picture')?.({ project_id: 'p1', variant_id: 'v1' })
    expect(reply?.isError).toBe(true)
    expect(JSON.parse(String(reply?.content[0]?.text))).toEqual({
      code: 'INTERNAL',
      message: INTERNAL_MESSAGE,
    })
    expect(JSON.stringify(reply)).not.toContain('made-up')
  })

  it('runs prepareInput on the camelCase input before the call', async () => {
    const calls: Call[] = []
    const handlers = session(toolSetup(ROWS), fakeCaller({ ok: true, data: {} }, calls))
    await handlers.get('made_up_write')?.({ project_id: 'p1', layer_id: 'l1' })
    expect(calls).toEqual([
      {
        name: 'layer.update',
        input: { projectId: 'p1', layerId: 'l1', filled: 'from l1' },
        agentClient: null,
      },
    ])
  })

  it('hands the cleaned client name of the session to execute', async () => {
    const calls: Call[] = []
    const caller = fakeCaller({ ok: true, data: {} }, calls)
    const handlers = session(toolSetup(ROWS), caller, 'Made-up Client')
    await handlers.get('made_up_write')?.({ project_id: 'p1', layer_id: 'l1' })
    expect(calls[0]?.agentClient).toBe('clean(Made-up Client)')
  })

  it('tells onCall the tool, client, project, ok and error kind of every call, no more', async () => {
    const seen: ToolCall[] = []
    const onCall = (call: ToolCall) => void seen.push(call)
    const good = session(toolSetup(ROWS, [], { onCall }), fakeCaller({ ok: true, data: {} }), 'X')
    await good.get('made_up_read')?.({ project_id: 'p1' })
    const refusal: Result<unknown> = { ok: false, error: { code: 'AGENT_REFUSED', message: 'N' } }
    const bad = session(toolSetup(ROWS, [], { onCall }), fakeCaller(refusal))
    await bad.get('made_up_write')?.({ layer_id: 'l1' })
    expect(seen).toEqual([
      { tool: 'made_up_read', agentClient: 'clean(X)', projectId: 'p1', ok: true, errorKind: null },
      {
        tool: 'made_up_write',
        agentClient: null,
        projectId: null,
        ok: false,
        errorKind: 'AGENT_REFUSED',
      },
    ])
  })
})
