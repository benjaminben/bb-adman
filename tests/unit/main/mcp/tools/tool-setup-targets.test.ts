// R2P-1 (spec/phases/round-2-platform.md, D6): a ToolDef may name several commands in targets
// and pick one per call with pickTarget, on the camelCase input. A picked name outside targets
// is the fixed INTERNAL reply and reaches no command. Made-up rows, a fake server and caller.
import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { toolSetup, type ToolCall, type ToolDef } from '@/main/mcp/tools'
import type { AgentCaller } from '@/main/mcp/agent-caller'
import { INTERNAL_MESSAGE, ok } from '@/shared/schemas/result'

type Reply = { content: Array<{ text?: string }>; isError?: boolean }
type Handler = (args: Record<string, unknown>) => Promise<Reply>

function session(rows: ToolDef[], calls: string[], heard: ToolCall[] = []) {
  const handlers = new Map<string, Handler>()
  const server = {
    registerTool: (name: string, _cfg: unknown, handler: Handler) => {
      handlers.set(name, handler)
    },
    server: { getClientVersion: () => undefined },
  }
  const caller: AgentCaller = {
    execute: async (name) => {
      calls.push(name)
      return ok({ picked: name })
    },
    query: async (name) => {
      calls.push(name)
      return ok({ picked: name })
    },
  }
  toolSetup(rows, [], { onCall: (c) => heard.push(c) })(server as unknown as McpServer, caller)
  return handlers
}

const replyOf = (r: Reply) => JSON.parse(r.content[0]?.text ?? 'null') as unknown

const PLAIN: ToolDef = {
  name: 'made_up_plain',
  description: 'Made up.',
  kind: 'command',
  target: 'made.plain',
  input: z.object({ projectId: z.string(), someText: z.string() }),
}

const TWO_WAY: ToolDef = {
  ...PLAIN,
  name: 'made_up_two_way',
  targets: ['made.plain', 'made.withFiles'],
  pickTarget: (input) => (String(input.someText).includes('/') ? 'made.withFiles' : 'made.plain'),
}

const STRAY: ToolDef = {
  ...TWO_WAY,
  name: 'made_up_stray',
  pickTarget: () => 'made.somethingElse',
}

describe('toolSetup with targets and pickTarget [R2P-1, D6]', () => {
  it('runs the command pickTarget names, from the camelCase input', async () => {
    const calls: string[] = []
    const tool = session([TWO_WAY], calls).get('made_up_two_way')
    const plain = await tool?.({ project_id: 'P1', some_text: 'no files' })
    const files = await tool?.({ project_id: 'P1', some_text: '/Users/x/a.png' })
    expect(calls).toEqual(['made.plain', 'made.withFiles'])
    expect(replyOf(plain as Reply)).toEqual({ picked: 'made.plain' })
    expect(replyOf(files as Reply)).toEqual({ picked: 'made.withFiles' })
  })

  it('answers a pick outside targets with the fixed INTERNAL reply and runs nothing', async () => {
    const calls: string[] = []
    const heard: ToolCall[] = []
    const reply = await session([STRAY], calls, heard).get('made_up_stray')?.({
      project_id: 'P1',
      some_text: 'x',
    })
    expect(calls).toEqual([])
    expect(reply?.isError).toBe(true)
    expect(replyOf(reply as Reply)).toEqual({ code: 'INTERNAL', message: INTERNAL_MESSAGE })
    expect(heard.map((c) => [c.ok, c.errorKind])).toEqual([[false, 'INTERNAL']])
  })

  it('runs target as before for a row with no pickTarget', async () => {
    const calls: string[] = []
    await session([PLAIN], calls).get('made_up_plain')?.({
      project_id: 'P1',
      some_text: '/a',
    })
    expect(calls).toEqual(['made.plain'])
  })
})
