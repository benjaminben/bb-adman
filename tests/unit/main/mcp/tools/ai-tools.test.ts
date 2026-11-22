// P10-5 (security class full): the AI tools in toolSetup, over a fake server and a fake agent
// caller. Each runs its own Phase 4 command; each replies { jobId } only; all three share the
// one serial of the start tools, across sessions; cut_out drops licence_confirmed before the
// command, so an agent cannot confirm a licence (S2-4).
import { describe, it, expect } from 'vitest'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { toolSetup } from '@/main/mcp/tools'
import { AI_TOOLS } from '@/main/mcp/tools/ai-tools'
import type { AgentCaller } from '@/main/mcp/agent-caller'

type Reply = { content: Array<{ text: string }>; isError?: boolean }
type Handler = (args: Record<string, unknown>) => Promise<Reply>

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

const caller = (execute: AgentCaller['execute']): AgentCaller => ({
  execute,
  query: async () => ({ ok: true, data: [] }),
})

const json = (reply: Reply): unknown => JSON.parse(reply.content[0]?.text ?? 'null')

const TOOLS: Array<[string, string]> = [
  ['propose_layout', 'generation.proposeLayout'],
  ['copy_options', 'generation.copyOptions'],
  ['cut_out', 'generation.cutOut'],
]

describe('the AI tools [P10-5, A-231]', () => {
  it('each runs its own command with the snake_case keys turned back, and replies { jobId } only', async () => {
    const calls: Array<[string, unknown]> = []
    const data = { jobId: 'j1', campaignId: 'c1', prompt: 'made-up', model: 'made-up-model' }
    const call = session(
      toolSetup(),
      caller(async (name, input) => {
        calls.push([name, input])
        return { ok: true, data }
      }),
    )
    for (const [tool] of TOOLS) {
      const reply = await call(tool, { project_id: 'p1', variant_id: 'v1', provider: 'fake' })
      expect(json(reply), tool).toEqual({ jobId: 'j1' })
    }
    expect(calls.map(([name]) => name)).toEqual(TOOLS.map(([, command]) => command))
    expect(calls[0]?.[1]).toEqual({ projectId: 'p1', variantId: 'v1', provider: 'fake' })
  })

  it('cut_out drops licence_confirmed, and no AI tool input names a licence', async () => {
    const seen: unknown[] = []
    const call = session(
      toolSetup(),
      caller(async (_name, input) => {
        seen.push(input)
        return { ok: true, data: { jobId: 'j1' } }
      }),
    )
    const args = { project_id: 'p1', variant_id: 'v1', layer_id: 'l1', provider: 'comfyui' }
    await call('cut_out', { ...args, licence_confirmed: true, licenceConfirmed: true })
    expect(seen).toEqual([{ projectId: 'p1', variantId: 'v1', layerId: 'l1', provider: 'comfyui' }])
    for (const row of AI_TOOLS) {
      expect(Object.keys(row.input.shape).join(' ').toLowerCase(), row.name).not.toContain(
        'licence',
      )
    }
  })

  it('the three run one at a time with the start tools, through one serial in every session', async () => {
    let active = 0
    let most = 0
    const slow = caller(async (name) => {
      active += 1
      most = Math.max(most, active)
      await new Promise((r) => setTimeout(r, 20))
      active -= 1
      return { ok: true, data: { jobId: name } }
    })
    const setup = toolSetup()
    const a = session(setup, slow)
    const b = session(setup, slow)
    await Promise.all([a('propose_layout'), b('copy_options'), a('cut_out'), b('generate_images')])
    expect(most).toBe(1)
    expect(AI_TOOLS.every((t) => t.oneAtATime === true)).toBe(true)
  })
})
