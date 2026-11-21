import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { makeCampaignBus, type CampaignBus } from './campaign-fixture'
import { testDeps } from './campaign-deps'
import { campaignQueries } from '../../../src/main/queries/campaign'
import { createQueryRunner } from '../../../src/main/queries/queries'
import type { CoreDeps } from '../../../src/main/core-deps'

// A made-up marker word as a bare token inside text that is not JSON. V8 words this error as
// `Unexpected token 'x', "<the text>" is not valid JSON`, quoting the stored value.
const MARKER = 'zebraquokka'
const DAMAGED = `{"a": ${MARKER}}`

let bus: CampaignBus
let deps: CoreDeps
let campaignId: string
const opts = { actor: 'user' as const }
const logLines: unknown[] = []

beforeEach(async () => {
  bus = makeCampaignBus()
  logLines.length = 0
  deps = testDeps({
    projects: bus.projects,
    log: { write: (line: unknown) => logLines.push(line) } as unknown as CoreDeps['log'],
  })
  const made = (await bus.create()) as { data: { campaignId: string } }
  campaignId = made.data.campaignId
})
afterEach(() => bus.cleanup())

const runGet = () =>
  createQueryRunner(campaignQueries(deps), deps.log)(
    'campaign.get',
    { projectId: bus.projectId, campaignId },
    opts,
  )

const damage = (table: 'campaign' | 'rule_set', column: string) => {
  const where = table === 'campaign' ? 'id' : 'campaign_id'
  bus.db.prepare(`UPDATE ${table} SET ${column} = ? WHERE ${where} = ?`).run(DAMAGED, campaignId)
}

describe('a damaged JSON column read as one row keeps its text out of the log [SPEC 14 1.42 C4-7, C-R6]', () => {
  it('campaign.get with a damaged brief answers INTERNAL and logs no piece of it', async () => {
    damage('campaign', 'brief')
    expect(await runGet()).toMatchObject({ ok: false, error: { code: 'INTERNAL' } })
    expect(logLines.length).toBeGreaterThan(0)
    expect(JSON.stringify(logLines)).not.toContain(MARKER)
  })

  it('campaign.get with a damaged rule set list answers INTERNAL and logs no piece of it', async () => {
    damage('rule_set', 'required_words')
    expect(await runGet()).toMatchObject({ ok: false, error: { code: 'INTERNAL' } })
    expect(logLines.length).toBeGreaterThan(0)
    expect(JSON.stringify(logLines)).not.toContain(MARKER)
  })

  it('campaign.update with a damaged brief answers INTERNAL and logs no piece of it', async () => {
    damage('campaign', 'brief')
    const result = await bus.user('campaign.update', { campaignId, languages: ['en'] })
    expect(result).toMatchObject({ ok: false, error: { code: 'INTERNAL' } })
    expect(bus.logText()).not.toBe('')
    expect(bus.logText()).not.toContain(MARKER)
  })

  it('campaign.delete with a damaged brief answers INTERNAL and logs no piece of it', async () => {
    damage('campaign', 'brief')
    const result = await bus.user('campaign.delete', { campaignId })
    expect(result).toMatchObject({ ok: false, error: { code: 'INTERNAL' } })
    expect(bus.logText()).not.toBe('')
    expect(bus.logText()).not.toContain(MARKER)
  })
})
