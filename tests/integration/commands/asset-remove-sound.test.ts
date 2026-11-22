// asset.remove while a variant names the file as its sound (spec/phases/phase-07.md, "Clips
// and the track", Sound, A-184; phase-07-slices.md P7-12). The kept ID counts as a use too.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { assetRemove } from '@/main/commands/asset/remove'
import { insertTestAsset } from '../assets/asset-rows'
import { makeAssetBus, expectRefused } from '../assets/asset-bus'
import { seedVariant } from '../assets/usage-rows'

let bus: ReturnType<typeof makeAssetBus>
const SONG = '01JD0000000000000000000021'
const OTHER = '01JD0000000000000000000022'

beforeEach(() => {
  bus = makeAssetBus([assetRemove()])
  for (const id of [SONG, OTHER]) {
    insertTestAsset(bus.db, { id, relPath: `${id}.mp3`, absPath: `/${id}.mp3` })
    bus.db.prepare("UPDATE asset SET kind = 'audio', mime = 'audio/mpeg' WHERE id = ?").run(id)
  }
  seedVariant(bus.db)
})
afterEach(() => bus.cleanup())

const nameSound = (sound: string, assetId: string) =>
  bus.db
    .prepare("UPDATE variant SET sound = ?, sound_asset_id = ? WHERE id = 'v23456'")
    .run(sound, assetId)

describe('asset.remove and the sound file [A-184]', () => {
  it.each(['file', 'clips', 'none'])(
    "refuses while a variant names it as its sound (sound '%s')",
    async (sound) => {
      nameSound(sound, SONG)
      const error = await expectRefused(
        bus,
        () => bus.user('asset.remove', { assetId: SONG }),
        'RULE_VIOLATION',
        'asset_in_use',
      )
      expect(error.message).toBe(
        'This file is in use. Take it off every post and out of every rule set first.',
      )
    },
  )

  it('removes an audio file no variant names', async () => {
    nameSound('file', OTHER)
    const result = await bus.changed(() => bus.user('asset.remove', { assetId: SONG }))
    expect(result).toEqual({ ok: true, data: { assetId: SONG } })
    expect(bus.db.prepare('SELECT id FROM asset').all()).toEqual([{ id: OTHER }])
  })
})
