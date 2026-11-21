import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { assetUpdate } from '@/main/commands/asset/update'
import { insertTestAsset } from './asset-rows'
import { makeAssetBus, expectRefused } from './asset-bus'
import { insertLayer, seedVariant } from './usage-rows'

let bus: ReturnType<typeof makeAssetBus>
const ID = '01JD0000000000000000000001'

beforeEach(() => {
  bus = makeAssetBus([assetUpdate()])
  bus.db
    .prepare("INSERT INTO subject (id, name, created_at) VALUES ('bottle', 'Bottle', 'x')")
    .run()
  insertTestAsset(bus.db, { id: ID, relPath: 'a.ttf', absPath: '/a.ttf', kind: 'font' })
})
afterEach(() => bus.cleanup())

const stored = () =>
  bus.db
    .prepare(
      'SELECT library, subject_id, display_name, font_publish_allowed FROM asset WHERE id = ?',
    )
    .get(ID)

describe('asset.update [SPEC 4.2, FR-054, R-12]', () => {
  it('changes library, subject, display name and font publishing, and names the row', async () => {
    const result = await bus.changed(() =>
      bus.user('asset.update', {
        assetId: ID,
        library: 'reference',
        subjectId: 'bottle',
        displayName: 'Brand font',
        fontPublishAllowed: true,
      }),
    )
    expect(result).toEqual({ ok: true, data: { assetId: ID } })
    expect(stored()).toEqual({
      library: 'reference',
      subject_id: 'bottle',
      display_name: 'Brand font',
      font_publish_allowed: 1,
    })
  })

  it('leaves out fields it is not given, and detaches the subject with null', async () => {
    await bus.user('asset.update', { assetId: ID, subjectId: 'bottle' })
    await bus.changed(() => bus.user('asset.update', { assetId: ID, subjectId: null }))
    expect(stored()).toEqual({
      library: 'asset',
      subject_id: null,
      display_name: `${ID}.png`,
      font_publish_allowed: 0,
    })
  })

  it('is not undoable', async () => {
    await bus.user('asset.update', { assetId: ID, displayName: 'X' })
    expect(bus.undo.state(bus.projectId, 'campaign:c1')).toEqual({
      canUndo: false,
      canRedo: false,
    })
  })

  it('refuses an asset the project does not hold with NOT_FOUND', async () => {
    await expectRefused(
      bus,
      () => bus.user('asset.update', { assetId: '01JD0000000000000000000009', displayName: 'X' }),
      'NOT_FOUND',
    )
  })

  it('refuses a subject the project does not hold with NOT_FOUND', async () => {
    await expectRefused(
      bus,
      () => bus.user('asset.update', { assetId: ID, subjectId: 'cup' }),
      'NOT_FOUND',
    )
  })

  it('refuses an empty display name with INVALID_INPUT', async () => {
    await expectRefused(
      bus,
      () => bus.user('asset.update', { assetId: ID, displayName: '  ' }),
      'INVALID_INPUT',
    )
  })
})

describe('asset.update and the reference library [SPEC 14, Slice A rulings point 6, A2-5]', () => {
  const PIC = '01JD0000000000000000000002'

  it('refuses to move an asset a layer shows to the reference library', async () => {
    seedVariant(bus.db)
    insertTestAsset(bus.db, { id: PIC, relPath: 'p.png', absPath: '/p.png' })
    insertLayer(bus.db, 'l1', { sourceAssetId: PIC })
    const error = await expectRefused(
      bus,
      () => bus.user('asset.update', { assetId: PIC, library: 'reference' }),
      'RULE_VIOLATION',
      'asset_in_use',
    )
    expect(error.message).toBe(
      'This file is in use. Take it off every post and out of every rule set first.',
    )
  })

  it('moves an asset nothing uses to the reference library', async () => {
    insertTestAsset(bus.db, { id: PIC, relPath: 'p.png', absPath: '/p.png' })
    const result = await bus.changed(() =>
      bus.user('asset.update', { assetId: PIC, library: 'reference' }),
    )
    expect(result).toEqual({ ok: true, data: { assetId: PIC } })
    expect(bus.db.prepare('SELECT library FROM asset WHERE id = ?').get(PIC)).toEqual({
      library: 'reference',
    })
  })

  it('still changes an in-use asset that is in the reference library already', async () => {
    seedVariant(bus.db)
    insertTestAsset(bus.db, { id: PIC, relPath: 'p.png', absPath: '/p.png', library: 'reference' })
    insertLayer(bus.db, 'l1', { sourceAssetId: PIC })
    const result = await bus.user('asset.update', {
      assetId: PIC,
      library: 'reference',
      displayName: 'Hero',
    })
    expect(result).toEqual({ ok: true, data: { assetId: PIC } })
  })
})
