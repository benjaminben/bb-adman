// P5-2: the outOfDate badge on campaign.get and variant.get, from rows written by hand
// (spec/links-and-sync.md, "Follow rules"; spec/data-rules.md [FR-081]).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { makeCampaignBus, type CampaignBus } from './campaign-fixture'
import { testDeps } from './campaign-deps'
import { campaignQueries } from '@/main/queries/campaign'
import { variantQueries } from '@/main/queries/variant'
import * as masterOfModule from '@/main/links/master-of'
import type { CoreDeps } from '@/main/core-deps'
import type { CampaignGet } from '@/shared/schemas/queries/campaign'
import type { VariantGet } from '@/shared/schemas/queries/variant'
import type { LayerRow } from '@/shared/schemas/rows/layer'

let bus: CampaignBus
let deps: CoreDeps
let campaignId: string
let masterId: string
const opts = { actor: 'user' as const }

const columnsOf = (table: string) =>
  (bus.db.prepare(`PRAGMA table_info("${table}")`).all() as Array<{ name: string }>).map(
    (c) => c.name,
  )

// Copies a row of `table` under a new ID, with the given columns replaced.
function copyRow(table: string, set: Record<string, string>, where: string): void {
  const names = columnsOf(table)
  const pick = names.map((n) => (n in set ? '?' : `"${n}"`)).join(', ')
  const values = names.filter((n) => n in set).map((n) => set[n])
  bus.db
    .prepare(
      `INSERT INTO "${table}" (${names.map((n) => `"${n}"`).join(', ')})
      SELECT ${pick} FROM "${table}" WHERE ${where}`,
    )
    .run(...values)
}

// A variant in `directionId`, in `language`, with a linked copy of each master layer, synced
// to the master.
function linkedCopy(variantId: string, directionId: string, language: string): void {
  const set = { id: variantId, direction_id: directionId, language }
  copyRow('variant', set, `id = '${masterId}'`)
  const layers = (bus.rows('layer') as LayerRow[]).filter((l) => l.variantId === masterId)
  for (const l of layers) {
    const id = `${variantId}-${l.key}`
    copyRow('layer', { id, variant_id: variantId }, `id = '${l.id}'`)
  }
  bus.db
    .prepare('UPDATE layer SET linked = 1, synced_revs = revs WHERE variant_id = ?')
    .run(variantId)
}

const bumpStyle = (variantId: string, key: string) =>
  bus.db
    .prepare(
      `UPDATE layer SET revs = json_set(revs, '$.style', json_extract(revs, '$.style') + 1)
       WHERE variant_id = ? AND key = ?`,
    )
    .run(variantId, key)

beforeEach(async () => {
  bus = makeCampaignBus()
  deps = testDeps({
    projects: bus.projects,
    assets: { missingAssetIds: async () => [] } as unknown as CoreDeps['assets'],
    log: { write: () => undefined } as unknown as CoreDeps['log'],
  })
  const made = (await bus.create()) as { data: { campaignId: string; variantId: string } }
  campaignId = made.data.campaignId
  masterId = made.data.variantId
  const directionId = (bus.rows('variant')[0] as { directionId: string }).directionId
  linkedCopy('behind', directionId, 'de')
  linkedCopy('current', directionId, 'fr')
  // The master's style moves on; "current" has synced it, "behind" has not.
  const key = (bus.rows('layer') as LayerRow[]).find((l) => l.variantId === masterId)?.key ?? ''
  bumpStyle(masterId, key)
  bus.db
    .prepare(
      `UPDATE layer SET synced_revs = (SELECT revs FROM layer m WHERE m.variant_id = ? AND m.key = ?)
       WHERE variant_id = 'current' AND key = ?`,
    )
    .run(masterId, key, key)
  // A second direction whose master is a copy of the first master, with nothing behind.
  copyRow('direction', { id: 'd2', master_variant_id: 'm2', sort: '1' }, `id = '${directionId}'`)
  linkedCopy('m2', 'd2', 'en')
})
afterEach(() => {
  vi.restoreAllMocks()
  bus.cleanup()
})

const campaignGet = async () =>
  (await campaignQueries(deps)['campaign.get']?.(
    { projectId: bus.projectId, campaignId },
    opts,
  )) as CampaignGet

const variantGet = async (variantId: string) =>
  (await variantQueries(deps)['variant.get']?.(
    { projectId: bus.projectId, variantId },
    opts,
  )) as VariantGet

describe('outOfDate on campaign.get and variant.get [FR-081]', () => {
  it('marks only the variant behind its master on style', async () => {
    const result = await campaignGet()
    const marks = Object.fromEntries(result.variants.map((v) => [v.id, v.badges.outOfDate]))
    expect(marks).toEqual({ [masterId]: false, behind: true, current: false, m2: false })
  })

  it('gives the same badge from variant.get', async () => {
    for (const id of [masterId, 'behind', 'current', 'm2']) {
      const summary = (await campaignGet()).variants.find((v) => v.id === id)
      expect((await variantGet(id)).variant.badges).toEqual(summary?.badges)
    }
  })

  it("reads each direction's master once per campaign.get", async () => {
    const spy = vi.spyOn(masterOfModule, 'masterOf')
    await campaignGet()
    expect(spy).toHaveBeenCalledTimes(2)
    expect(spy.mock.calls.map((c) => c[1]).sort()).toEqual(
      [(bus.rows('variant')[0] as { directionId: string }).directionId, 'd2'].sort(),
    )
  })
})
