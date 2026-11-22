// tools/list and tools/call over the real HTTP door, for the MCP-B tests. Not a test file.
import * as c from './http-client'

// The 4.5 tools whose command or query exists on main (SPEC 14 1.56, MCP-B; MCP-D; MCP-G).
export const BUILT_TOOLS = [
  'list_projects',
  'get_project',
  'list_assets',
  'get_campaign',
  'create_campaign',
  'get_slots',
  'get_job',
  'list_jobs',
  'generate_images',
  'generate_video',
  'cancel_job',
  'list_subjects',
  'get_variant',
  'render_variant',
  'create_layer',
  'update_layer',
  'update_layers',
  'delete_layer',
  'reorder_layers',
  'delete_campaign',
]

export type ToolReply = {
  content?: Array<{ type: string; text?: string }>
  isError?: boolean
}

export type ListedTool = { name: string; description?: string; inputSchema: unknown }

export type ToolSession = {
  list(): Promise<ListedTool[]>
  call(name: string, args: unknown, extra?: Record<string, unknown>): Promise<ToolReply>
  raw(name: string, args: unknown): Promise<string>
}

export async function toolSession(port: number, token: string): Promise<ToolSession> {
  const id = await c.openSession(port, token)
  const headers = c.sessionHeaders(port, token, id)
  let n = 10
  const send = (method: string, params: unknown) =>
    c.send({ port, headers, body: { jsonrpc: '2.0', id: n++, method, params } })
  return {
    async list() {
      const msg = c.message(await send('tools/list', {})) as { result?: { tools: ListedTool[] } }
      return msg.result?.tools ?? []
    },
    async call(name, args, extra = {}) {
      const reply = await send('tools/call', { name, arguments: args, ...extra })
      const msg = c.message(reply) as { result?: ToolReply; error?: { message: string } }
      if (msg.error) return { isError: true, content: [{ type: 'text', text: msg.error.message }] }
      return msg.result ?? {}
    },
    async raw(name, args) {
      return JSON.stringify(await send('tools/call', { name, arguments: args }))
    },
  }
}

// The JSON a tool reply carries in its one text item.
export function replyJson<T>(reply: ToolReply): T {
  const text = reply.content?.find((i) => i.type === 'text')?.text
  if (text === undefined) throw new Error('the tool reply has no text item')
  return JSON.parse(text) as T
}
