// P5-12: sync.preview over a real project file, with linked variants written by hand
// (spec/links-and-sync.md, "Sync"). Its own small fixture: P5-3's linked-fixture is not merged.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { makeCampaignBus, type CampaignBus } from '../campaigns/campaign-fixture'
import { testDeps } from '../campaigns/campaign-deps'
import { campaignQueries } from '@/main/queries/campaign'
import { syncQueries } from '@/main/queries/sync'
import type { CoreDeps } from '@/main/core-deps'
import type { CampaignGet } from '@/shared/schemas/queries/campaign'
import type { SyncPreviewReply } from '@/shared/schemas/queries/sync'
import type { LayerRow } from '@/shared/schemas/rows/layer'

let bus: CampaignBus
let deps: CoreDeps
let campaignId: string
let masterId: string
let directionId: string

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

const masterLayers = () => (bus.rows('layer') as LayerRow[]).filter((l) => l.variantId === masterId)

// A variant of the direction in `language`, made at `createdAt`, with a linked copy of each
// master layer synced to the master.
function linkedCopy(variantId: string, language: string, createdAt: string): void {
  const set = { id: variantId, language, created_at: createdAt }
  copyRow('variant', set, `id = '${masterId}'`)
  for (const l of masterLayers()) {
    copyRow('layer', { id: `${variantId}-${l.key}`, variant_id: variantId }, `id = '${l.id}'`)
  }
  bus.db
    .prepare('UPDATE layer SET linked = 1, synced_revs = revs WHERE variant_id = ?')
    .run(variantId)
}

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
  directionId = (bus.rows('variant')[0] as { directionId: string }).directionId
  linkedCopy('late', 'fr', '2026-12-03T00:00:00.000Z')
  linkedCopy('current', 'es', '2026-12-02T00:00:00.000Z')
  linkedCopy('early', 'it', '2026-12-01T00:00:00.000Z')
  // The master's first layer moves on in style; "current" catches up, the others do not.
  const key = masterLayers()[0]?.key ?? ''
  bus.db
    .prepare(
      `UPDATE layer SET revs = json_set(revs, '$.style', json_extract(revs, '$.style') + 1)
       WHERE variant_id = ? AND key = ?`,
    )
    .run(masterId, key)
  bus.db
    .prepare(
      `UPDATE layer SET synced_revs = (SELECT revs FROM layer m WHERE m.variant_id = ? AND m.key = ?)
       WHERE variant_id = 'current' AND key = ?`,
    )
    .run(masterId, key, key)
  bus.db.prepare('UPDATE variant SET rev = 7 WHERE id = ?').run(masterId)
})
afterEach(() => bus.cleanup())

const preview = async (actor: 'user' | 'agent' = 'user', over: object = {}) =>
  (await syncQueries(deps)['sync.preview']?.(
    { projectId: bus.projectId, directionId, ...over },
    { actor },
  )) as SyncPreviewReply

describe('sync.preview [spec/links-and-sync.md, "Sync"]', () => {
  it("names the direction, its master and the master's rev", async () => {
    const reply = await preview()
    expect(reply).toMatchObject({ directionId, masterVariantId: masterId, masterRev: 7 })
  })

  it('lists only the out-of-date variants, in campaign.get order', async () => {
    const reply = await preview()
    const got = (await campaignQueries(deps)['campaign.get']?.(
      { projectId: bus.projectId, campaignId },
      { actor: 'user' },
    )) as CampaignGet
    const stale = got.variants.filter((v) => v.badges.outOfDate).map((v) => v.id)
    expect(stale).toEqual(['early', 'late'])
    expect(reply.variants.map((v) => v.variantId)).toEqual(stale)
    const first = masterLayers()[0]
    expect(reply.variants[0]?.changes).toEqual([
      {
        layerKey: first?.key,
        layerName: first?.name,
        kind: 'update',
        groups: ['style'],
        proposed: { style: first?.style },
        blockedByOverride: [],
      },
    ])
  })

  it('an unknown direction is NOT_FOUND', async () => {
    await expect(preview('user', { directionId: 'nope' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'That direction was not found.',
    })
  })

  it('the agent may read it and gets the same reply, with no file path', async () => {
    const reply = await preview('agent')
    expect(reply).toEqual(await preview('user'))
    expect(JSON.stringify(reply)).not.toMatch(/absPath|relPath|\.adman/)
  })

  it('writes nothing', async () => {
    const before = JSON.stringify([bus.rows('variant'), bus.rows('layer')])
    await preview()
    expect(JSON.stringify([bus.rows('variant'), bus.rows('layer')])).toEqual(before)
  })
})
