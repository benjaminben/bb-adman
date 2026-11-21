// MCP-D read tools over the real HTTP door: list_projects, get_slots, get_job, list_jobs
// (spec/mcp-and-agents.md, the tool table and notes) (security class).
import { describe, it, expect, afterEach } from 'vitest'
import { data } from '../core-fixture'
import { stopAndClean } from './mcp-fixture'
import { replyJson } from './tool-client'
import { allKeys, insertJob, JOB_VIEW_KEYS, readSetUp, type ReadSetUp } from './read-tools-fixture'
import { startComfyStandIn, type StandIn } from '../../helpers/comfy-stand-in'
import type { TemplateSlots } from '@/shared/schemas/queries/campaign'

let r: ReadSetUp | undefined
let stand: StandIn | undefined
afterEach(async () => {
  await stopAndClean(r?.fx)
  await stand?.close()
  r = undefined
  stand = undefined
})

type View = Record<string, unknown>

describe('list_projects [MCP-D; FR-201]', () => {
  it('gives only id and name of each open project', async () => {
    r = await readSetUp()
    const reply = await r.s.call('list_projects', {})
    expect(reply.isError).toBeFalsy()
    expect(replyJson(reply)).toEqual([{ id: r.projectId, name: 'Reads' }])
    expect(JSON.stringify(reply)).not.toContain(r.fx.projectsDir)
  })
})

describe('get_slots [MCP-D; FR-192]', () => {
  it('gives slotId, type, state and candidates per slot of the master variant', async () => {
    r = await readSetUp()
    const input = { projectId: r.projectId, campaignId: r.campaignId }
    const slots = data<TemplateSlots>(
      await r.fx.core.query('template.slots', input, { actor: 'user' }),
    )
    const reply = await r.s.call('get_slots', {
      project_id: r.projectId,
      campaign_id: r.campaignId,
    })
    expect(reply.isError).toBeFalsy()
    expect(replyJson(reply)).toEqual(
      slots.map((s) => ({
        slotId: s.slot.id,
        type: s.slot.type,
        state: s.state,
        candidates: s.candidates,
      })),
    )
  })

  it('gives NOT_FOUND as a tool error for a campaign the project does not hold', async () => {
    r = await readSetUp()
    const reply = await r.s.call('get_slots', { project_id: r.projectId, campaign_id: 'nope' })
    expect(reply.isError).toBe(true)
    expect(replyJson(reply)).toMatchObject({ code: 'NOT_FOUND' })
  })
})

describe('get_job [MCP-D; FR-279]', () => {
  it('gives the job view and nothing outside its allow-list', async () => {
    r = await readSetUp()
    insertJob(r, { id: 'j1' })
    const reply = await r.s.call('get_job', { project_id: r.projectId, job_id: 'j1' })
    expect(reply.isError).toBeFalsy()
    const view = replyJson<View>(reply)
    expect(view).toMatchObject({ id: 'j1', assetIds: ['a1', 'a2'], failures: { offline: 1 } })
    expect(allKeys(view, new Set(['failures'])).filter((k) => !JOB_VIEW_KEYS.has(k))).toEqual([])
    for (const hidden of ['made-up-model', 'made-up-remote-id', 'made-up-host', 'referencePath']) {
      expect(JSON.stringify(reply), hidden).not.toContain(hidden)
    }
  })

  it('gives NOT_FOUND as a tool error for an unknown job ID', async () => {
    r = await readSetUp()
    const reply = await r.s.call('get_job', { project_id: r.projectId, job_id: 'made-up-job' })
    expect(reply.isError).toBe(true)
    expect(replyJson(reply)).toMatchObject({
      code: 'NOT_FOUND',
      message: 'That job was not found.',
    })
  })

  it('a failed job message names "the saved ComfyUI address", never the stand-in origin', async () => {
    r = await readSetUp()
    stand = await startComfyStandIn()
    data(await r.fx.user('comfy.setAddress', { address: stand.origin }))
    const result = { assetIds: [], failures: { offline: 1 }, serverAddress: stand.origin }
    insertJob(r, {
      id: 'j1',
      result,
      errorReason: 'no_answer',
      detail: `No answer at ${stand.origin}`,
    })
    const reply = await r.s.call('get_job', { project_id: r.projectId, job_id: 'j1' })
    const view = replyJson<View>(reply)
    expect(view.message).toContain('the saved ComfyUI address')
    expect(JSON.stringify(reply)).not.toContain(stand.origin)
    expect(JSON.stringify(reply)).not.toContain(`127.0.0.1:${stand.port}`)
  })

  it('says to poll no more than once every 5 seconds', async () => {
    r = await readSetUp()
    const tool = (await r.s.list()).find((t) => t.name === 'get_job')
    expect(tool?.description).toMatch(/no more than once every 5 seconds/)
  })
})

describe('list_jobs [MCP-D; FR-279]', () => {
  it('gives the job view per job, newest first, filtered like job.list', async () => {
    r = await readSetUp()
    insertJob(r, { id: 'old', createdAt: '2026-01-01T00:00:00Z' })
    insertJob(r, { id: 'new', createdAt: '2026-01-02T00:00:00Z', status: 'running' })
    insertJob(r, {
      id: 'other',
      campaignId: null,
      variantId: null,
      createdAt: '2026-01-03T00:00:00Z',
    })
    const all = replyJson<View[]>(await r.s.call('list_jobs', { project_id: r.projectId }))
    expect(all.map((j) => j.id)).toEqual(['other', 'new', 'old'])
    const mine = await r.s.call('list_jobs', { project_id: r.projectId, campaign_id: r.campaignId })
    expect(replyJson<View[]>(mine).map((j) => j.id)).toEqual(['new', 'old'])
    const active = await r.s.call('list_jobs', { project_id: r.projectId, state: 'active' })
    expect(replyJson<View[]>(active).map((j) => j.id)).toEqual(['new'])
    const one = await r.s.call('list_jobs', { project_id: r.projectId, limit: 1 })
    expect(replyJson<View[]>(one).map((j) => j.id)).toEqual(['other'])
    const keys = allKeys(all, new Set(['failures']))
    expect(keys.filter((k) => !JOB_VIEW_KEYS.has(k))).toEqual([])
  })
})
