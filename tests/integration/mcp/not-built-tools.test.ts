// P10-1 (security, A-230): over the real HTTP door, no notBuilt row is listed in tools/list,
// and a call to its name is answered exactly as a name that was never a tool, with nothing run.
// Since P10-12 every planned tool is built, so the notBuilt list is empty: the list test then
// checks that exactly the table's tools are listed, and the unknown-name case stands on its own.
import { describe, it, expect, afterEach } from 'vitest'
import { data } from '../core-fixture'
import { createInput } from '../campaigns/campaign-fixture'
import { makeMcpFixture, stopAndClean, type McpFixture } from './mcp-fixture'
import { toolSession } from './tool-client'
import { ALL_TOOLS } from '@/main/mcp/tools/table'

let f: McpFixture | undefined
afterEach(async () => {
  await stopAndClean(f)
  f = undefined
})

const NOT_BUILT = ALL_TOOLS.filter((t) => t.notBuilt).map((t) => t.name)

async function setup() {
  f = await makeMcpFixture()
  data(await f.user('mcp.setEnabled', { enabled: true }))
  const made = await f.user('project.create', { name: 'A', location: f.projectsDir })
  const { projectId } = data<{ projectId: string }>(made)
  const camp = await f.user('campaign.create', { projectId, ...createInput() })
  const { campaignId } = data<{ campaignId: string }>(camp)
  return { fx: f, projectId, campaignId, s: await toolSession(f.port, await f.token()) }
}

describe('notBuilt tools over the MCP door [P10-1, A-230]', () => {
  it('lists none of them', async () => {
    const { s } = await setup()
    const listed = (await s.list()).map((t) => t.name)
    for (const name of NOT_BUILT) expect(listed, name).not.toContain(name)
    expect(listed).toEqual(ALL_TOOLS.filter((t) => !t.notBuilt).map((t) => t.name))
  })

  it('answers a call to a name that was never a tool as not found and runs nothing', async () => {
    const { fx, s, projectId, campaignId } = await setup()
    const args = { project_id: projectId, campaign_id: campaignId, variant_id: 'v1' }
    const before = fx.events.length
    const logBefore = fx.readLogs()
    const reply = JSON.stringify(await s.call('never_a_tool', args))
    expect(reply).toContain('Tool never_a_tool not found')
    expect(fx.events.slice(before)).toEqual([])
    expect(fx.readLogs()).toEqual(logBefore)
  })

  it.each(NOT_BUILT)('answers a call to %s as an unknown tool and runs nothing', async (name) => {
    const { fx, s, projectId, campaignId } = await setup()
    const args = { project_id: projectId, campaign_id: campaignId, variant_id: 'v1' }
    const before = fx.events.length
    const logBefore = fx.readLogs()
    const reply = JSON.stringify(await s.call(name, args))
    const unknown = JSON.stringify(await s.call('never_a_tool', args))
    expect(reply.replaceAll(name, 'X')).toEqual(unknown.replaceAll('never_a_tool', 'X'))
    expect(reply).toContain(`Tool ${name} not found`)
    expect(fx.events.slice(before)).toEqual([])
    expect(fx.readLogs()).toEqual(logBefore)
    const read = await fx.core.query('campaign.get', { projectId, campaignId }, { actor: 'user' })
    expect(read.ok).toBe(true)
  })
})
