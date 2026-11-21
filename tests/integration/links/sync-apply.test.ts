// P5-13: sync.apply writes the accepted master changes, worked out from the database, as one
// campaign entry (spec/links-and-sync.md, "Sync"; FR-082, FR-083; A-134, A-137, A-141, A-148).
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { expectRefused, makeAssetBus } from '../assets/asset-bus'
import { testDeps } from '../campaigns/campaign-deps'
import { createInput } from '../campaigns/campaign-fixture'
import { addLinkedVariant, copyRow, linkedLayerId } from './linked-fixture'
import { campaignCommands } from '@/main/commands/campaign'
import { layerCommands } from '@/main/commands/layer'
import { variantCommands } from '@/main/commands/variant'
import { syncCommands } from '@/main/commands/sync'
import { denialMessage } from '@/main/commands/agent-policy'
import { campaignQueries } from '@/main/queries/campaign'
import { syncQueries } from '@/main/queries/sync'
import { readWireRow } from '@/main/db/rows'
import { readLayers } from '@/main/links/snapshot'
import type { CoreDeps } from '@/main/core-deps'
import type { CampaignGet } from '@/shared/schemas/queries/campaign'
import type { SyncPreviewReply } from '@/shared/schemas/queries/sync'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import type { VariantRow } from '@/shared/schemas/rows/variant'

type Bus = ReturnType<typeof makeAssetBus>
let bus: Bus
let deps: CoreDeps
let masterId: string
let directionId: string
let campaignId: string
let textKey: string
let backKey: string

beforeEach(async () => {
  deps = testDeps({ log: { write: () => undefined } as unknown as CoreDeps['log'] })
  bus = makeAssetBus([
    ...campaignCommands(deps),
    ...layerCommands(deps),
    ...variantCommands(deps),
    ...syncCommands(deps),
  ])
  const assets = { missingAssetIds: async () => [] } as unknown as CoreDeps['assets']
  deps = testDeps({ projects: bus.projects, log: deps.log, assets })
  await bus.user('campaign.create', createInput())
  const d = bus.db.prepare('SELECT id, campaign_id AS c, master_variant_id AS m FROM direction')
  const row = d.get() as { id: string; c: string; m: string }
  ;[directionId, campaignId, masterId] = [row.id, row.c, row.m]
  const layers = readLayers(bus.db, masterId)
  textKey = layers.find((l) => l.type === 'text')?.key ?? ''
  backKey = layers.find((l) => l.type === 'background')?.key ?? ''
  addLinkedVariant(bus.db, masterId, 'same')
  addLinkedVariant(bus.db, masterId, 'tall', { height: variantOf(masterId).height + 100 })
  addLinkedVariant(bus.db, masterId, 'de', { language: 'de' })
})
afterEach(() => bus.cleanup())

const variantOf = (id: string) => readWireRow(bus.db, 'variant', { id }) as VariantRow
const layerOf = (variantId: string, key: string) =>
  readLayers(bus.db, variantId).find((l) => l.key === key) as LayerRow
const masterText = () => layerOf(masterId, textKey)
const masterRev = () => variantOf(masterId).rev
const edit = (layerId: string, patch: Record<string, unknown>) =>
  bus.user('layer.update', { layerId, patch })
const apply = (decisions: object[], rev = masterRev(), actor: 'user' | 'agent' = 'user') =>
  bus.bus.execute(
    'sync.apply',
    { projectId: bus.projectId, directionId, masterRev: rev, decisions },
    { actor },
  )
const accept = (variantId: string, key: string, overrides: object[] = []) => ({
  variantId,
  layerKey: key,
  accept: true,
  overrides,
})
const preview = async () =>
  (await syncQueries(deps)['sync.preview']?.(
    { projectId: bus.projectId, directionId },
    { actor: 'user' },
  )) as SyncPreviewReply
const staleIds = async () => (await preview()).variants.map((v) => v.variantId)
const outOfDate = async () => {
  const got = (await campaignQueries(deps)['campaign.get']?.(
    { projectId: bus.projectId, campaignId },
    { actor: 'user' },
  )) as CampaignGet
  return got.variants.filter((v) => v.badges.outOfDate).map((v) => v.id)
}
const BLACK = { style: { color: '#000000' } }

describe('sync.apply [spec/links-and-sync.md, "Sync"]', () => {
  it('accepts one of two variants; the other stays out of date', async () => {
    await edit(masterText().id, BLACK)
    const revs = { same: variantOf('same').rev, tall: variantOf('tall').rev }
    const result = await bus.changed(() => apply([accept('same', textKey)]))
    expect(result).toEqual({ ok: true, data: { variantIds: ['same'] } })
    const synced = layerOf('same', textKey)
    expect(synced.style).toEqual(masterText().style)
    expect(synced.syncedRevs).toEqual(masterText().revs)
    expect([variantOf('same').rev, variantOf('tall').rev]).toEqual([revs.same + 1, revs.tall])
    expect(await staleIds()).toEqual(['de', 'tall'])
    expect(bus.undo.state(bus.projectId, `campaign:${campaignId}`).canUndo).toBe(true)
  })

  it('take-master writes the colour and removes the path', async () => {
    await edit(linkedLayerId('same', textKey), { style: { color: '#ff0000' } })
    await edit(masterText().id, BLACK)
    const path = { path: 'style.color', choice: 'take-master' }
    expect(await apply([accept('same', textKey, [path])])).toMatchObject({ ok: true })
    const layer = layerOf('same', textKey)
    expect(layer.style).toMatchObject({ color: '#000000' })
    expect(layer.overrides).toEqual([])
  })

  it('keep-mine keeps the colour and the path and marks the group synced', async () => {
    await edit(linkedLayerId('same', textKey), { style: { color: '#ff0000' } })
    await edit(masterText().id, BLACK)
    const path = { path: 'style.color', choice: 'keep-mine' }
    expect(await apply([accept('same', textKey, [path])])).toMatchObject({ ok: true })
    const layer = layerOf('same', textKey)
    expect(layer.style).toMatchObject({ color: '#ff0000' })
    expect(layer.overrides).toEqual(['style.color'])
    expect(layer.syncedRevs).toEqual(masterText().revs)
    expect(await staleIds()).not.toContain('same')
  })

  it('an added layer goes on top, linked, with a new ID and its own variant', async () => {
    const made = (await bus.user('layer.create', { variantId: masterId, type: 'text' })) as {
      data: { layerId: string }
    }
    const from = readWireRow(bus.db, 'layer', { id: made.data.layerId }) as LayerRow
    const top = Math.max(...readLayers(bus.db, 'same').map((l) => l.z))
    expect(await apply([accept('same', from.key)])).toMatchObject({ ok: true })
    const added = layerOf('same', from.key)
    expect(added.id).not.toBe(from.id)
    expect(added).toMatchObject({ variantId: 'same', linked: true, overrides: [], z: top + 1 })
    expect(added.syncedRevs).toEqual(from.revs)
    expect(added.copy).toBe(from.copy)
  })

  it('a removed layer is deleted', async () => {
    await bus.user('layer.delete', { layerId: masterText().id })
    expect(await apply([accept('same', textKey)])).toMatchObject({ ok: true })
    expect(layerOf('same', textKey)).toBeUndefined()
    expect(layerOf('tall', textKey)).toBeDefined()
  })

  it('a stale translation keeps the text and is marked missing [A-134]', async () => {
    const before = layerOf('de', textKey)
    await edit(masterText().id, { copy: 'Brand new words' })
    expect(await apply([accept('de', textKey)])).toMatchObject({ ok: true })
    const layer = layerOf('de', textKey)
    expect(layer.copy).toBe(before.copy)
    expect(layer).toMatchObject({ translationStatus: 'missing', translationSource: null })
    expect(layer.syncedRevs).toEqual(masterText().revs)
  })

  it('a refused change or one with no decision writes nothing', async () => {
    await edit(masterText().id, BLACK)
    const refused = { ...accept('same', textKey), accept: false }
    expect(await bus.changed(() => apply([refused]))).toEqual({
      ok: true,
      data: { variantIds: [] },
    })
    expect(bus.undo.state(bus.projectId, `campaign:${campaignId}`).canUndo).toBe(false)
  })

  it('refuses master_changed after a master edit and writes nothing', async () => {
    await edit(masterText().id, BLACK)
    const rev = masterRev()
    await edit(masterText().id, { style: { color: '#00ff00' } })
    await expectRefused(
      bus,
      () => apply([accept('same', textKey)], rev),
      'RULE_VIOLATION',
      'master_changed',
    )
  })

  it.each([
    ['the master', () => [accept(masterId, textKey)]],
    ['a variant of another direction', () => [accept('other', textKey)]],
    ['a key with no change', () => [accept('same', backKey)]],
    ['an unknown key', () => [accept('same', 'no-such-key')]],
    [
      'the same change twice',
      () => [accept('same', textKey), accept('tall', textKey), accept('same', textKey)],
    ],
  ])('a choice for %s is INVALID_INPUT', async (_label, decisions) => {
    copyRow(bus.db, 'direction', directionId, { id: 'D2', name: 'Other', sort: 9 })
    copyRow(bus.db, 'variant', 'same', { id: 'other', direction_id: 'D2' })
    await edit(masterText().id, BLACK)
    const error = await expectRefused(bus, () => apply(decisions()), 'INVALID_INPUT')
    expect(error.message).toBe('A sync choice does not match the changes.')
  })

  it('an unknown direction is NOT_FOUND', async () => {
    const run = () => bus.user('sync.apply', { directionId: 'nope', masterRev: 0, decisions: [] })
    await expectRefused(bus, run, 'NOT_FOUND')
  })

  it('after an accept-all nothing is out of date; one undo brings it all back', async () => {
    await bus.user('layer.create', { variantId: masterId, type: 'text' })
    await edit(masterText().id, { ...BLACK, copy: 'Brand new words' })
    await edit(linkedLayerId('same', textKey), { name: 'Own name' })
    const all = (await preview()).variants.flatMap((v) =>
      v.changes.map((c) => accept(v.variantId, c.layerKey)),
    )
    const stale = await outOfDate()
    expect(stale.sort()).toEqual(['de', 'same', 'tall'])
    const before = ['same', 'tall', 'de'].map((id) => readLayers(bus.db, id))
    const result = (await apply(all)) as { ok: boolean; data: { variantIds: string[] } }
    expect(result.data.variantIds.sort()).toEqual(['de', 'same', 'tall'])
    expect(await outOfDate()).toEqual([])
    expect(bus.undo.state(bus.projectId, 'variant:same')).toEqual({
      canUndo: false,
      canRedo: false,
    })
    const scope = `campaign:${campaignId}`
    expect(await bus.user('history.undo', { scope })).toMatchObject({ ok: true })
    expect(['same', 'tall', 'de'].map((id) => readLayers(bus.db, id))).toEqual(before)
    expect((await outOfDate()).sort()).toEqual(stale.sort())
  })

  it('is denied to the agent', async () => {
    await edit(masterText().id, BLACK)
    expect(await apply([accept('same', textKey)], masterRev(), 'agent')).toEqual({
      ok: false,
      error: { code: 'AGENT_DENIED', message: denialMessage('sync.apply') },
    })
  })
})
