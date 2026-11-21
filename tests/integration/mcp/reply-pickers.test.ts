// MCP-D: get_project and get_campaign answer through allow-list pickers, so a field added
// later to a campaign, variant, subject, rule set or direction row (a path, say) does not
// leave through MCP without a change to the picker (spec/mcp-and-agents.md; FR-198).
import { describe, it, expect, afterEach } from 'vitest'
import { data } from '../core-fixture'
import { stopAndClean } from './mcp-fixture'
import { replyJson } from './tool-client'
import { readSetUp, type ReadSetUp } from './read-tools-fixture'
import { campaignFields, projectFields } from '@/main/mcp/tools/project-replies'
import { MCP_TOOLS } from '@/main/mcp/tools'
import type { CampaignGet, ProjectGet } from '@/shared/schemas/queries/campaign'

let r: ReadSetUp | undefined
afterEach(async () => {
  await stopAndClean(r?.fx)
  r = undefined
})

const PLANTED = '/Users/made-up/planted-path'
const CTX = { providers: [] }

type Node = Record<string, unknown>

// Adds a made-up path field to the object at each place, in a deep copy.
function planted<T>(value: T, places: Array<(v: Node) => Node[]>): T {
  const copy = structuredClone(value) as Node
  for (const at of places) for (const node of at(copy)) node.plantedPath = PLANTED
  return copy as T
}

const list = (v: unknown) => v as Node[]
const obj = (v: unknown) => v as Node

async function replies() {
  r = await readSetUp()
  const { projectId, campaignId } = r
  const as = { actor: 'user' as const }
  const project = data<ProjectGet>(await r.fx.core.query('project.get', { projectId }, as))
  const input = { projectId, campaignId }
  const campaign = data<CampaignGet>(await r.fx.core.query('campaign.get', input, as))
  return { project, campaign }
}

describe('get_project and get_campaign pickers [MCP-D; FR-198] (security class)', () => {
  it('are the replies of the two tools, and every query tool has a picker', () => {
    const tool = (name: string) => MCP_TOOLS.find((t) => t.name === name)
    expect(tool('get_project')?.reply).toBe(projectFields)
    expect(tool('get_campaign')?.reply).toBe(campaignFields)
    for (const t of MCP_TOOLS.filter((x) => x.kind === 'query')) {
      expect(t.reply, t.name).toBeTypeOf('function')
    }
  })

  it('give every field of today, so the tools still answer what the queries give', async () => {
    const { project, campaign } = await replies()
    expect(projectFields(project, CTX)).toEqual(project)
    expect(campaignFields(campaign, CTX)).toEqual(campaign)
    if (!r) throw new Error('no set-up')
    const args = { project_id: r.projectId, campaign_id: r.campaignId }
    expect(replyJson(await r.s.call('get_project', args))).toEqual(project)
    expect(replyJson(await r.s.call('get_campaign', args))).toEqual(campaign)
  })

  it('get_project leaves out a field added later at every level', async () => {
    const { project } = await replies()
    const later = planted(project, [
      (v) => [v],
      (v) => [obj(v.meta)],
      (v) => list(v.subjects),
      (v) => list(v.campaigns),
    ])
    expect(list(later.subjects).length).toBeGreaterThan(0)
    expect(list(later.campaigns).length).toBeGreaterThan(0)
    const meta = { ...obj(later.meta), assetsDirAbs: PLANTED, assetsDirRel: PLANTED }
    const picked = projectFields({ ...later, meta }, CTX)
    expect(picked).toEqual(project)
    expect(JSON.stringify(picked)).not.toContain(PLANTED)
  })

  it('get_campaign leaves out a field added later at every level', async () => {
    const { campaign } = await replies()
    const brief = (v: Node) => obj(obj(v.campaign).brief)
    const later = planted(campaign, [
      (v) => [v],
      (v) => [obj(v.campaign)],
      (v) => [brief(v)],
      (v) => list(brief(v).subjects),
      (v) => Object.values(obj(brief(v).copy ?? {})).map(obj),
      (v) => list(obj(v.campaign).sizes),
      (v) => list(v.subjects),
      (v) => [obj(v.ruleSet)],
      (v) => list(v.directions),
      (v) => list(v.variants),
      (v) => list(v.variants).map((x) => obj(x.badges)),
      (v) => [obj(v.marks)],
    ])
    expect(list(later.variants).length).toBeGreaterThan(0)
    expect(list(later.directions).length).toBeGreaterThan(0)
    const picked = campaignFields(later, CTX)
    expect(picked).toEqual(campaign)
    expect(JSON.stringify(picked)).not.toContain(PLANTED)
  })
})
