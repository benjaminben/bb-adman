// Registers the fixed tool table on one session's MCP server (SPEC 4.5; 14 1.56 MCP-B).
// Every call goes through the agent caller, so the actor is always agent and the agent
// policy in core decides. A reply is the command's or query's own result as JSON; an
// error is the app's own code, message and details, as an MCP tool error (SPEC 4.5).
import { z } from 'zod'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import type { ToolSetup } from '@/main/mcp/sessions'
import type { AgentCaller } from '@/main/mcp/agent-caller'
import type { Result } from '@/shared/schemas/result'
import { MCP_TOOLS, type ToolDef } from './table'
import type { ReplyContext, ReplyPicker } from './read-replies'

export { MCP_TOOLS, type ToolDef }

const snake = (key: string) => key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)

const text = (value: unknown, isError: boolean): CallToolResult => ({
  content: [{ type: 'text', text: JSON.stringify(value) }],
  ...(isError ? { isError: true } : {}),
})

function toReply(result: Result<unknown>, ctx: ReplyContext, pick?: ReplyPicker): CallToolResult {
  if (!result.ok) return text(result.error, true)
  return text(pick ? pick(result.data, ctx) : result.data, false)
}

// The tool's input: the same field schemas, with snake_case top-level keys. Unknown keys,
// an actor among them, are dropped by the parse before the handler runs.
function snakeInput(def: ToolDef) {
  const names = new Map(Object.keys(def.input.shape).map((k) => [snake(k), k]))
  const shape = Object.fromEntries([...names].map(([s, k]) => [s, def.input.shape[k]]))
  return { names, schema: z.object(shape) }
}

function run(def: ToolDef, caller: AgentCaller, input: unknown): Promise<Result<unknown>> {
  return def.kind === 'command'
    ? caller.execute(def.target, input)
    : caller.query(def.target, input)
}

// providers: the labels a job's message names (MCP-D agentJobView).
export function toolSetup(
  table: readonly ToolDef[] = MCP_TOOLS,
  providers: ReplyContext['providers'] = [],
): ToolSetup {
  const ctx: ReplyContext = { providers }
  return (server, caller) => {
    for (const def of table) {
      const { names, schema } = snakeInput(def)
      server.registerTool(
        def.name,
        { description: def.description, inputSchema: schema },
        async (args: Record<string, unknown>) => {
          const input: Record<string, unknown> = {}
          for (const [s, k] of names) if (Object.hasOwn(args, s)) input[k] = args[s]
          return toReply(await run(def, caller, input), ctx, def.reply)
        },
      )
    }
  }
}
