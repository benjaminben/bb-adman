// variant.setSound (spec/phases/phase-07.md, "Clips and the track", Sound, A-184;
// phase-07-slices.md P7-12): each value, the stored asset kept, undo and the refusals.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { expectRefused } from '../assets/asset-bus'
import { insertTestAsset } from '../assets/asset-rows'
import { makeLayerBus, type LayerBus } from './layer-fixture'

let bus: LayerBus
const SONG = '01JD0000000000000000000011'
const TUNE = '01JD0000000000000000000012'
const PICTURE = '01JD0000000000000000000013'
const REFERENCE_SONG = '01JD0000000000000000000014'

function insertAudio(id: string, library: 'asset' | 'reference' = 'asset'): void {
  insertTestAsset(bus.db, { id, relPath: `${id}.mp3`, absPath: `/${id}.mp3`, library })
  bus.db.prepare("UPDATE asset SET kind = 'audio', mime = 'audio/mpeg' WHERE id = ?").run(id)
}

beforeEach(async () => {
  bus = await makeLayerBus()
  insertAudio(SONG)
  insertAudio(TUNE)
  insertAudio(REFERENCE_SONG, 'reference')
  insertTestAsset(bus.db, { id: PICTURE, relPath: 'p.png', absPath: '/p.png' })
})
afterEach(() => bus.cleanup())

const setSound = (input: Record<string, unknown>) =>
  bus.user('variant.setSound', { variantId: bus.variantId, ...input })
const sound = () => {
  const v = bus.variant()
  return { sound: v.sound, soundAssetId: v.soundAssetId }
}
const NOTHING = { canUndo: false, canRedo: false }

describe('variant.setSound [A-184]', () => {
  it('starts with the clips sound and no file', () => {
    expect(sound()).toEqual({ sound: 'clips', soundAssetId: null })
  })

  it.each([
    [{ sound: 'none' }, { sound: 'none', soundAssetId: null }],
    [
      { sound: 'file', assetId: SONG },
      { sound: 'file', soundAssetId: SONG },
    ],
  ])('stores %j, bumps rev and names the variant row', async (input, stored) => {
    const result = await bus.changed(() => setSound(input))
    expect(result).toEqual({ ok: true, data: { variantId: bus.variantId } })
    expect(sound()).toEqual(stored)
    expect(bus.variant().rev).toBe(1)
  })

  it('goes back to the clips sound', async () => {
    await setSound({ sound: 'none' })
    expect(await bus.changed(() => setSound({ sound: 'clips' }))).toMatchObject({ ok: true })
    expect(sound()).toEqual({ sound: 'clips', soundAssetId: null })
  })

  it.each(['clips', 'none'])('leaving the file for %s keeps the asset ID', async (value) => {
    await setSound({ sound: 'file', assetId: SONG })
    expect(await setSound({ sound: value })).toMatchObject({ ok: true })
    expect(sound()).toEqual({ sound: value, soundAssetId: SONG })
  })

  it("'file' with no asset uses the stored asset", async () => {
    await setSound({ sound: 'file', assetId: SONG })
    await setSound({ sound: 'none' })
    expect(await bus.changed(() => setSound({ sound: 'file' }))).toMatchObject({ ok: true })
    expect(sound()).toEqual({ sound: 'file', soundAssetId: SONG })
  })

  it('swaps one audio file for another', async () => {
    await setSound({ sound: 'file', assetId: SONG })
    expect(await setSound({ sound: 'file', assetId: TUNE })).toMatchObject({ ok: true })
    expect(sound()).toEqual({ sound: 'file', soundAssetId: TUNE })
  })

  it('changes nothing for the stored sound, and still answers ok', async () => {
    await setSound({ sound: 'file', assetId: SONG })
    const stored = bus.variant()
    const events = bus.events.length
    for (const input of [{ sound: 'file', assetId: SONG }, { sound: 'file' }]) {
      expect(await setSound(input)).toEqual({ ok: true, data: { variantId: bus.variantId } })
    }
    expect(bus.variant()).toEqual(stored)
    expect(bus.events.slice(events).filter((e) => e.name === 'project.changed')).toEqual([])
    await bus.history('undo')
    expect(bus.undoState()).toEqual({ canUndo: false, canRedo: true })
  })

  it("is undone and redone on the variant's list", async () => {
    await setSound({ sound: 'file', assetId: SONG })
    await setSound({ sound: 'file', assetId: TUNE })
    await setSound({ sound: 'none' })
    expect(await bus.history('undo')).toMatchObject({ ok: true })
    expect(sound()).toEqual({ sound: 'file', soundAssetId: TUNE })
    expect(await bus.history('undo')).toMatchObject({ ok: true })
    expect(sound()).toEqual({ sound: 'file', soundAssetId: SONG })
    expect(await bus.history('redo')).toMatchObject({ ok: true })
    expect(await bus.history('redo')).toMatchObject({ ok: true })
    expect(sound()).toEqual({ sound: 'none', soundAssetId: TUNE })
  })

  it('undoing the first file goes back to the clips sound and keeps the asset ID', async () => {
    await setSound({ sound: 'file', assetId: SONG })
    expect(await bus.history('undo')).toMatchObject({ ok: true })
    expect(sound()).toEqual({ sound: 'clips', soundAssetId: SONG })
  })
})

describe('variant.setSound refusals [A-184]', () => {
  it.each([
    ['a picture', { sound: 'file', assetId: PICTURE }],
    ['a reference-library audio file', { sound: 'file', assetId: REFERENCE_SONG }],
    ['an ID that names no asset', { sound: 'file', assetId: '01JD0000000000000000000099' }],
    ["'file' with no asset and none stored", { sound: 'file' }],
  ])('refuses %s with sound_asset_not_audio', async (_name, input) => {
    const error = await expectRefused(
      bus,
      () => setSound(input),
      'RULE_VIOLATION',
      'sound_asset_not_audio',
    )
    expect(error.message).toBe(
      'Choose an audio file (MP3, WAV, M4A or AAC) from the assets library.',
    )
    expect(bus.undoState()).toEqual(NOTHING)
  })

  it('answers NOT_FOUND for a variant the project does not hold', async () => {
    const error = await expectRefused(
      bus,
      () => setSound({ variantId: 'gone', sound: 'none' }),
      'NOT_FOUND',
    )
    expect(error.message).toBe('That variant was not found.')
    expect(bus.undoState()).toEqual(NOTHING)
  })

  it.each<Record<string, unknown>>([
    { sound: 'clips', assetId: SONG },
    { sound: 'loud' },
    { sound: 'file', assetId: '' },
  ])('refuses %j with INVALID_INPUT', async (input) => {
    await expectRefused(bus, () => setSound(input), 'INVALID_INPUT')
    expect(bus.undoState()).toEqual(NOTHING)
  })

  it('is denied to the agent', async () => {
    expect(
      await bus.agent('variant.setSound', { variantId: bus.variantId, sound: 'none' }),
    ).toMatchObject({ ok: false, error: { code: 'AGENT_DENIED' } })
    expect(sound()).toEqual({ sound: 'clips', soundAssetId: null })
  })
})
