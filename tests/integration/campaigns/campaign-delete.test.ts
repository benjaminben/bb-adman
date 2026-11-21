import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { expectRefused } from '../assets/asset-bus'
import { makeCampaignBus, createInput, type CampaignBus } from './campaign-fixture'
import { makeBusFixture } from '../commands/test-bus'
import { campaignCommands } from '@/main/commands/campaign'
import { subjectCommands } from '@/main/commands/subject'
import { testDeps } from './campaign-deps'
import { tableCounts } from './table-counts'

let bus: CampaignBus
let campaignId: string
let variantId: string
beforeEach(async () => {
  bus = makeCampaignBus()
  const made = (await bus.create()) as { data: { campaignId: string; variantId: string } }
  campaignId = made.data.campaignId
  variantId = made.data.variantId
})
afterEach(() => bus.cleanup())

const count = (table: string) =>
  (bus.db.prepare(`SELECT COUNT(*) AS n FROM "${table}"`).get() as { n: number }).n

describe('campaign.delete [SPEC 4.2, FR-197]', () => {
  it('removes the campaign and everything under it, and names each removed row', async () => {
    bus.db
      .prepare(
        `INSERT INTO variant_check (variant_id, checked_rev, ran_at, ran_by, results)
         VALUES (?, 0, 'x', 'user', '[]')`,
      )
      .run(variantId)
    bus.db
      .prepare(
        "INSERT INTO report (id, campaign_id, created_at, output_dir, body) VALUES ('r1', ?, 'x', 'o', '{}')",
      )
      .run(campaignId)
    const result = await bus.changed(() => bus.user('campaign.delete', { campaignId }))
    expect(result).toEqual({ ok: true, data: { campaignId } })
    for (const table of [
      'campaign',
      'campaign_subject',
      'rule_set',
      'direction',
      'variant',
      'variant_subject',
      'layer',
      'variant_check',
      'report',
    ]) {
      expect(count(table)).toBe(0)
    }
  })

  it('keeps the subjects, which belong to the project', async () => {
    await bus.user('campaign.delete', { campaignId })
    expect(count('subject')).toBe(2)
  })

  it('answers NOT_FOUND for a campaign the project does not hold', async () => {
    await expectRefused(
      bus,
      () => bus.user('campaign.delete', { campaignId: 'x-222222' }),
      'NOT_FOUND',
    )
  })

  it('is not undoable', async () => {
    await bus.user('campaign.delete', { campaignId })
    expect(bus.undo.state(bus.projectId, `campaign:${campaignId}`)).toEqual({
      canUndo: false,
      canRedo: false,
    })
  })
})

describe('campaign.delete refuses while work runs [SPEC 4.2 1.42, C-R4, C4-4]', () => {
  const addJob = (
    id: string,
    status: string,
    column: 'campaign_id' | 'variant_id',
    value: string,
  ) =>
    bus.db
      .prepare(
        `INSERT INTO job (id, kind, status, ${column}, request, created_at, updated_at)
         VALUES (?, 'image_generation', ?, ?, '{}', 'x', 'x')`,
      )
      .run(id, status, value)
  const del = () => bus.user('campaign.delete', { campaignId })

  it("refuses with jobs_running and count 1 for a queued job with the campaign's ID", async () => {
    addJob('J1', 'queued', 'campaign_id', campaignId)
    const before = tableCounts(bus.db)
    const error = await expectRefused(bus, del, 'RULE_VIOLATION', 'jobs_running')
    expect(error.details).toEqual({ reason: 'jobs_running', count: 1 })
    expect(error.message).toBe(
      'Work is still running in this campaign. Stop it, or wait for it to finish.',
    )
    expect(tableCounts(bus.db)).toEqual(before)
  })

  it("refuses the same way for a running job with only the variant's ID", async () => {
    addJob('J1', 'running', 'variant_id', variantId)
    const error = await expectRefused(bus, del, 'RULE_VIOLATION', 'jobs_running')
    expect(error.details).toEqual({ reason: 'jobs_running', count: 1 })
  })

  it('does not refuse for a succeeded job or a failed job', async () => {
    addJob('J1', 'succeeded', 'campaign_id', campaignId)
    addJob('J2', 'failed', 'variant_id', variantId)
    expect(await del()).toEqual({ ok: true, data: { campaignId } })
  })

  it('does not refuse for a running job of another campaign', async () => {
    const other = (await bus.create({
      subjectMap: [
        { subjectId: 'can', create: false },
        { subjectId: 'bottle', create: false },
      ],
    })) as { data: { campaignId: string; variantId: string } }
    addJob('J1', 'running', 'campaign_id', other.data.campaignId)
    addJob('J2', 'running', 'variant_id', other.data.variantId)
    expect(await del()).toEqual({ ok: true, data: { campaignId } })
  })
})

describe('campaign.delete by an agent asks first [D-023]', () => {
  it('runs only when the user allows it, even for a campaign the agent created', async () => {
    let asked = 0
    const deps = testDeps()
    const handlers = [...campaignCommands(deps), ...subjectCommands(deps)]
    for (const allow of [false, true]) {
      const f = makeBusFixture(handlers, async () => {
        asked++
        return allow
      })
      const agent = (name: string, input: Record<string, unknown>) =>
        f.bus.execute(name, { projectId: f.projectId, ...input }, { actor: 'agent' })
      const made = (await agent('campaign.create', createInput())) as {
        data: { campaignId: string }
      }
      const result = await agent('campaign.delete', { campaignId: made.data.campaignId })
      expect(result.ok).toBe(allow)
      if (!allow) expect(result).toMatchObject({ error: { code: 'AGENT_REFUSED' } })
      f.cleanup()
    }
    expect(asked).toBe(2)
  })
})
