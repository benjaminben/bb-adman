// P6-1: the variant_check wire row is read and checked as every table's is (SPEC 4.4), and the
// variant reads take the check badges from it. A fresh row with only passes marks nothing.
import { describe, it, expect, afterEach } from 'vitest'
import { makeFixture, data, type Fixture } from '../core-fixture'
import { createInput } from '../campaigns/campaign-fixture'
import { readWireRow } from '@/main/db/rows'
import type { CampaignGet } from '@/shared/schemas/queries/campaign'
import type { VariantGet } from '@/shared/schemas/queries/variant'

let f: Fixture | undefined
afterEach(() => {
  f?.cleanup()
  f = undefined
})

const PASS = [
  { checkId: 'text-overflow', group: 'readiness', status: 'pass', findings: [] },
  { checkId: 'text-colours', group: 'brand-legal', status: 'pass', findings: [] },
]

async function setup() {
  const fx = makeFixture()
  f = fx
  const { projectId } = data<{ projectId: string }>(
    await fx.user('project.create', { name: 'A', location: fx.projectsDir }),
  )
  const { campaignId, variantId } = data<{ campaignId: string; variantId: string }>(
    await fx.user('campaign.create', { projectId, ...createInput() }),
  )
  const db = fx.core.deps.projects.requireOpen(projectId).db
  db.prepare(
    `INSERT INTO variant_check (variant_id, checked_rev, ran_at, ran_by, results)
     VALUES (?, 0, '2026-01-01T00:00:00.000Z', 'agent', ?)`,
  ).run(variantId, JSON.stringify(PASS))
  return { fx, db, projectId, campaignId, variantId }
}

describe('the variant_check row [P6-1, SPEC 4.4]', () => {
  it('reads as a wire row with its results parsed', async () => {
    const { db, variantId } = await setup()
    expect(readWireRow(db, 'variant_check', { variantId })).toEqual({
      variantId,
      checkedRev: 0,
      ranAt: '2026-01-01T00:00:00.000Z',
      ranBy: 'agent',
      results: PASS,
    })
  })

  it('campaign.get and variant.get still answer, with no check mark for a fresh pass', async () => {
    const { fx, projectId, campaignId, variantId } = await setup()
    const opts = { actor: 'user' as const }
    const campaign = data<CampaignGet>(
      await fx.core.query('campaign.get', { projectId, campaignId }, opts),
    )
    const variant = data<VariantGet>(
      await fx.core.query('variant.get', { projectId, variantId }, opts),
    )
    for (const badges of [campaign.variants[0]?.badges, variant.variant.badges]) {
      expect(badges).toMatchObject({ checkWarning: false, checkStale: false })
    }
  })
})
