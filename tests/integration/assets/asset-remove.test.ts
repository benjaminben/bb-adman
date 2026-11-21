import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { assetRemove } from '@/main/commands/asset/remove'
import { readWireRows } from '@/main/db/rows'
import { insertTestAsset } from './asset-rows'
import { makeAssetBus, expectRefused } from './asset-bus'
import { insertClip, insertLayer, insertRuleSet, seedVariant } from './usage-rows'

let bus: ReturnType<typeof makeAssetBus>
const ID = '01JD0000000000000000000001'
const OTHER = '01JD0000000000000000000002'

beforeEach(() => {
  bus = makeAssetBus([assetRemove()])
  insertTestAsset(bus.db, { id: ID, relPath: 'a.png', absPath: '/a.png' })
  insertTestAsset(bus.db, { id: OTHER, relPath: 'b.png', absPath: '/b.png' })
  seedVariant(bus.db)
})
afterEach(() => bus.cleanup())

const ids = () => bus.db.prepare('SELECT id FROM asset ORDER BY id').all()

describe('asset.remove [SPEC 4.2, FR-197]', () => {
  it('removes an asset nothing uses and names the removed row', async () => {
    insertLayer(bus.db, 'l1', { sourceAssetId: OTHER })
    insertRuleSet(bus.db, [OTHER])
    const result = await bus.changed(() => bus.user('asset.remove', { assetId: ID }))
    expect(result).toEqual({ ok: true, data: { assetId: ID } })
    expect(ids()).toEqual([{ id: OTHER }])
  })

  it('checks the usage rows are readable, so the refusals below test the rule', () => {
    insertLayer(bus.db, 'l1', { sourceAssetId: ID })
    insertLayer(bus.db, 'l2', { fontAssetId: ID })
    insertRuleSet(bus.db, [ID])
    expect(readWireRows(bus.db, 'layer')).toHaveLength(2)
    expect(readWireRows(bus.db, 'rule_set')).toHaveLength(1)
  })

  it('refuses while an image layer shows it', async () => {
    insertLayer(bus.db, 'l1', { sourceAssetId: ID })
    await expectRefused(
      bus,
      () => bus.user('asset.remove', { assetId: ID }),
      'RULE_VIOLATION',
      'asset_in_use',
    )
  })

  it('refuses while a text layer uses it as its font', async () => {
    insertLayer(bus.db, 'l1', { fontAssetId: ID })
    await expectRefused(
      bus,
      () => bus.user('asset.remove', { assetId: ID }),
      'RULE_VIOLATION',
      'asset_in_use',
    )
  })

  it('refuses while a background clip uses it', async () => {
    insertClip(bus.db, ID)
    await expectRefused(
      bus,
      () => bus.user('asset.remove', { assetId: ID }),
      'RULE_VIOLATION',
      'asset_in_use',
    )
  })

  it('refuses while a rule set requires it', async () => {
    insertRuleSet(bus.db, [OTHER, ID])
    const error = await expectRefused(
      bus,
      () => bus.user('asset.remove', { assetId: ID }),
      'RULE_VIOLATION',
      'asset_in_use',
    )
    expect(error.message).toBe(
      'This file is in use. Take it off every post and out of every rule set first.',
    )
  })

  it('refuses an asset the project does not hold with NOT_FOUND', async () => {
    await expectRefused(
      bus,
      () => bus.user('asset.remove', { assetId: '01JD0000000000000000000009' }),
      'NOT_FOUND',
    )
  })
})
