// MCP-G (security class): the start and cancel tools in toolSetup, over a fake server and a
// fake agent caller. The two start tools share one serial across every session; each of the
// three replies { jobId } only; a refusal is returned as the command gives it.
import { describe, it, expect } from 'vitest'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { MCP_TOOLS, toolSetup } from '@/main/mcp/tools'
import type { AgentCaller } from '@/main/mcp/agent-caller'
import type { Result } from '@/shared/schemas/result'

type Reply = { content: Array<{ text: string }>; isError?: boolean }
type Handler = (args: Record<string, unknown>) => Promise<Reply>

// One fake session: the handlers toolSetup registered on it, by tool name.
function session(setup: ReturnType<typeof toolSetup>, caller: AgentCaller) {
  const handlers = new Map<string, Handler>()
  const server = {
    registerTool: (name: string, _cfg: unknown, handler: Handler) => {
      handlers.set(name, handler)
    },
  }
  setup(server as unknown as McpServer, caller)
  return (name: string, args: Record<string, unknown> = {}) => {
    const handler = handlers.get(name)
    if (!handler) throw new Error(`no tool ${name}`)
    return handler(args)
  }
}

function caller(execute: AgentCaller['execute']): AgentCaller {
  return { execute, query: async () => ({ ok: true, data: [] }) }
}

const json = (reply: Reply): unknown => JSON.parse(reply.content[0]?.text ?? 'null')

const RUN_TOOLS: Array<[string, string]> = [
  ['generate_images', 'generation.runImages'],
  ['generate_video', 'generation.startVideo'],
  ['cancel_job', 'job.cancel'],
]

describe('the start and cancel tools [MCP-G; spec/mcp-and-agents.md]', () => {
  it('each runs its own command with the snake_case keys turned back', async () => {
    const calls: Array<[string, unknown]> = []
    const call = session(
      toolSetup(),
      caller(async (name, input) => {
        calls.push([name, input])
        return { ok: true, data: { jobId: 'j1' } }
      }),
    )
    for (const [tool] of RUN_TOOLS) await call(tool, { project_id: 'p1', job_id: 'j1' })
    expect(calls.map(([name]) => name)).toEqual(RUN_TOOLS.map(([, command]) => command))
    expect(calls[2]?.[1]).toEqual({ projectId: 'p1', jobId: 'j1' })
    const listed = MCP_TOOLS.filter((t) => RUN_TOOLS.some(([tool]) => tool === t.name))
    expect(listed.map((t) => [t.name, t.kind])).toEqual(RUN_TOOLS.map(([t]) => [t, 'command']))
  })

  it('each replies { jobId } only, whatever else the command gives [FR-198]', async () => {
    const data = { jobId: 'j1', filePath: '/Users/made-up/picture.png', provider: 'comfyui' }
    const call = session(
      toolSetup(),
      caller(async () => ({ ok: true, data })),
    )
    for (const [tool] of RUN_TOOLS) {
      const reply = await call(tool)
      expect(reply.isError, tool).toBeUndefined()
      expect(json(reply), tool).toEqual({ jobId: 'j1' })
    }
  })

  it('each returns a refusal as the command gives it', async () => {
    const refusal: Result<unknown> = {
      ok: false,
      error: { code: 'MISSING_FILE', message: 'A file is gone.', details: { assetIds: ['a1'] } },
    }
    const call = session(
      toolSetup(),
      caller(async () => refusal),
    )
    for (const [tool] of RUN_TOOLS) {
      const reply = await call(tool)
      expect(reply.isError, tool).toBe(true)
      expect(json(reply), tool).toEqual(refusal.error)
    }
  })

  it('the two start tools run one at a time, through one serial shared by every session', async () => {
    let active = 0
    let most = 0
    const order: string[] = []
    const slow = caller(async (name) => {
      active += 1
      most = Math.max(most, active)
      order.push(`start ${name}`)
      await new Promise((r) => setTimeout(r, 20))
      order.push(`end ${name}`)
      active -= 1
      return { ok: true, data: { jobId: name } }
    })
    const setup = toolSetup()
    const a = session(setup, slow)
    const b = session(setup, slow)
    await Promise.all([a('generate_images'), b('generate_video'), a('generate_images')])
    expect(most).toBe(1)
    expect(order).toHaveLength(6)
  })

  it('a refused start does not stop the next one', async () => {
    let n = 0
    const call = session(
      toolSetup(),
      caller(async () => {
        n += 1
        if (n === 1) return { ok: false, error: { code: 'AGENT_DENIED', message: 'No.' } }
        return { ok: true, data: { jobId: 'j2' } }
      }),
    )
    const [first, second] = await Promise.all([call('generate_images'), call('generate_images')])
    expect(first?.isError).toBe(true)
    expect(json(second as Reply)).toEqual({ jobId: 'j2' })
  })
})
