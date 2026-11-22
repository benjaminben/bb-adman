import { describe, it, expect, afterEach } from 'vitest'
import { data } from '../core-fixture'
import { makeMcpFixture, stopAndClean, type McpFixture } from './mcp-fixture'
import * as c from './http-client'

let f: McpFixture | undefined
afterEach(async () => {
  await stopAndClean(f)
  f = undefined
})

// The tools of SPEC 4.5. None of them returns file contents, paths, settings or secrets.
// MCP-B adds tools from this list only; its own snapshot test (Section 10.3) checks the rest.
const SECTION_4_5_TOOLS = [
  'list_projects',
  'get_project',
  'list_subjects',
  'list_assets',
  'get_campaign',
  'get_variant',
  'render_variant',
  'create_campaign',
  'add_variant',
  'set_variant_format',
  'create_layer',
  'update_layer',
  'update_layers',
  'delete_layer',
  'reorder_layers',
  'set_translation',
  'run_checks',
  'get_check_results',
  'delete_variant',
  'delete_campaign',
  'get_slots',
  'get_job',
  'list_jobs',
  'generate_images',
  'generate_video',
  'cancel_job',
  'propose_layout',
  'copy_options',
  'cut_out',
  'import_assets',
  'create_campaign_from_brief',
  'create_project',
  'delete_subject',
]

async function listTools(fx: McpFixture): Promise<string[]> {
  const token = await fx.token()
  const id = await c.openSession(fx.port, token)
  const body = { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }
  const reply = await c.send({ port: fx.port, headers: c.sessionHeaders(fx.port, token, id), body })
  expect(reply.status).toBe(200)
  const msg = c.message(reply) as {
    result?: { tools: Array<{ name: string }> }
    error?: { code: number }
  }
  // With no tool registered the SDK has no tools/list handler: "method not found".
  if (msg.error) return (expect(msg.error.code).toBe(-32601), [])
  return msg.result?.tools.map((t) => t.name) ?? ['(no result)']
}

describe('the tools the server offers [SPEC 4.5, FR-198, 1.56 review point 8]', () => {
  it('offers no tool in MCP-A, and only tools of 4.5 after it', async () => {
    f = await makeMcpFixture()
    data(await f.user('mcp.setEnabled', { enabled: true }))
    const names = await listTools(f)
    expect(names.filter((n) => !SECTION_4_5_TOOLS.includes(n))).toEqual([])
    expect(names.some((n) => /secret|token|setting|connect|file|path/i.test(n))).toBe(false)
  })

  it('answers a call to a tool that does not exist with an error, not with data', async () => {
    f = await makeMcpFixture()
    data(await f.user('mcp.setEnabled', { enabled: true }))
    const token = await f.token()
    const id = await c.openSession(f.port, token)
    const params = { name: 'get_connect_info', arguments: {} }
    const body = { jsonrpc: '2.0', id: 3, method: 'tools/call', params }
    const reply = await c.send({ port: f.port, headers: c.sessionHeaders(f.port, token, id), body })
    const msg = c.message(reply) as { error?: unknown; result?: { isError?: boolean } }
    expect(msg.error !== undefined || msg.result?.isError === true).toBe(true)
  })
})
