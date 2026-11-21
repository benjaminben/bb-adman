import { describe, it, expect, afterEach } from 'vitest'
import { data } from '../core-fixture'
import { makeMcpFixture, stopAndClean, type McpFixture } from './mcp-fixture'
import { BUILT_TOOLS, toolSession } from './tool-client'

let f: McpFixture | undefined
afterEach(async () => {
  await stopAndClean(f)
  f = undefined
})

// SPEC 10.3: the MCP tool list is snapshot-tested, so a change to a tool's name,
// description or input is a visible diff. MCP-B holds the 4.5 tools built so far.
describe('the MCP tool list [SPEC 10.3, 4.5]', () => {
  it('matches the pinned names, descriptions and input schemas', async () => {
    f = await makeMcpFixture()
    data(await f.user('mcp.setEnabled', { enabled: true }))
    const s = await toolSession(f.port, await f.token())
    const tools = (await s.list()).map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    }))
    expect(tools.map((t) => t.name)).toEqual(BUILT_TOOLS)
    expect(tools).toMatchSnapshot()
  })
})
