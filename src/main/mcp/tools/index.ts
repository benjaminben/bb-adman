// Registers the fixed tool table on one session's MCP server (SPEC 4.5; 14 1.56 MCP-B).
// Every call goes through the agent caller, so the actor is always agent and the agent
// policy in core decides. A reply is the command's or query's own result as JSON; an
// error is the app's own code, message and details, as an MCP tool error (SPEC 4.5).
// Phase 10 (A-230, A-241, A-242): a notBuilt row is not registered; a png row replies one
// image item; prepareInput runs before the call; onCall hears of every call.
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import type { ToolSetup } from '@/main/mcp/sessions'
import type { AgentCaller } from '@/main/mcp/agent-caller'
import { cleanClientName } from '@/main/mcp/client-name'
import { fail, INTERNAL_MESSAGE, type Result } from '@/shared/schemas/result'
import { MCP_TOOLS, type ToolDef } from './table'
import type { ReplyContext, ReplyPicker } from './read-replies'
import { createSerial } from '@/main/mcp/serial'

export { MCP_TOOLS, type ToolDef }

// What onCall hears after every call: no input and no reply (A-241).
export type ToolCall = {
  tool: string
  agentClient: string | null
  projectId: string | null
  ok: boolean
  errorKind: string | null
}

export type ToolHooks = { onCall?: (call: ToolCall) => void }

const snake = (key: string) => key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)

const text = (value: unknown, isError: boolean): CallToolResult => ({
  content: [{ type: 'text', text: JSON.stringify(value) }],
  ...(isError ? { isError: true } : {}),
})

const pngOf = (data: unknown): unknown => (data as { png?: unknown } | null)?.png

// A png row whose reply holds no PNG bytes is a fault: the fixed INTERNAL reply, no data.
function checkPng(def: ToolDef, result: Result<unknown>): Result<unknown> {
  if (def.content !== 'png' || !result.ok || pngOf(result.data) instanceof Uint8Array) {
    return result
  }
  return fail({ code: 'INTERNAL', message: INTERNAL_MESSAGE })
}

// A-234: the drawn PNG bytes only, never a path, a name or an address of any source.
function image(png: Uint8Array): CallToolResult {
  const base64 = Buffer.from(png.buffer, png.byteOffset, png.byteLength).toString('base64')
  return { content: [{ type: 'image', data: base64, mimeType: 'image/png' }] }
}

function toReply(result: Result<unknown>, ctx: ReplyContext, def: ToolDef): CallToolResult {
  if (!result.ok) return text(result.error, true)
  if (def.content === 'png') return image(pngOf(result.data) as Uint8Array)
  const pick: ReplyPicker | undefined = def.reply
  return text(pick ? pick(result.data, ctx) : result.data, false)
}

// The tool's input: the same field schemas, with snake_case top-level keys. Unknown keys,
// an actor among them, are dropped by the parse before the handler runs.
function snakeInput(def: ToolDef) {
  const names = new Map(Object.keys(def.input.shape).map((k) => [snake(k), k]))
  const shape = Object.fromEntries([...names].map(([s, k]) => [s, def.input.shape[k]]))
  return { names, schema: z.object(shape) }
}

function run(
  def: ToolDef,
  caller: AgentCaller,
  input: unknown,
  agentClient: string | null,
): Promise<Result<unknown>> {
  return def.kind === 'command'
    ? caller.execute(def.target, input, agentClient)
    : caller.query(def.target, input)
}

// The client's own name from its initialize hello, cleaned (A-242). Read at call time, since
// the hello comes after the tools are registered.
function clientOf(server: McpServer): string | null {
  return cleanClientName(server.server?.getClientVersion?.()?.name)
}

function projectOf(input: Record<string, unknown>): string | null {
  return typeof input.projectId === 'string' ? input.projectId : null
}

// providers: the labels a job's message names (MCP-D agentJobView).
export function toolSetup(
  table: readonly ToolDef[] = MCP_TOOLS,
  providers: ReplyContext['providers'] = [],
  hooks: ToolHooks = {},
): ToolSetup {
  const ctx: ReplyContext = { providers }
  // MCP-G: the start tools run one at a time, through this one serial, in every session.
  const serial = createSerial()
  return (server, caller) => {
    for (const def of table) {
      if (def.notBuilt) continue
      const { names, schema } = snakeInput(def)
      server.registerTool(
        def.name,
        { description: def.description, inputSchema: schema },
        async (args: Record<string, unknown>) => {
          const mapped: Record<string, unknown> = {}
          for (const [s, k] of names) if (Object.hasOwn(args, s)) mapped[k] = args[s]
          const input = def.prepareInput ? def.prepareInput(mapped) : mapped
          const agentClient = clientOf(server)
          const call = () => run(def, caller, input, agentClient)
          const result = checkPng(def, def.oneAtATime ? await serial(call) : await call())
          hooks.onCall?.({
            tool: def.name,
            agentClient,
            projectId: projectOf(input),
            ok: result.ok,
            errorKind: result.ok ? null : result.error.code,
          })
          return toReply(result, ctx, def)
        },
      )
    }
  }
}
