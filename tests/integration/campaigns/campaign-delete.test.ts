import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { expectRefused } from '../assets/asset-bus'
import { makeCampaignBus, createInput, type CampaignBus } from './campaign-fixture'
import { makeBusFixture } from '../commands/test-bus'
import { campaignCommands } from '../../../src/main/commands/campaign'
import { subjectCommands } from '../../../src/main/commands/subject'
import { testDeps } from './campaign-deps'

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
