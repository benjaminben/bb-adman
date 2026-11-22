// P7-9: clip.restore, the internal inverse of clip.remove and clip.reorder. It takes whole rows,
// so each row is checked as the public commands check what they write: no restore writes a row
// another command would refuse.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { expectRefused } from '../assets/asset-bus'
import { clipIdOf, makeClipBus, type ClipBus } from './clip-fixture'
import type { BackgroundClipRow } from '@/shared/schemas/rows/background-clip'

let bus: ClipBus
let kept: BackgroundClipRow
beforeEach(async () => {
  bus = await makeClipBus()
  bus.addAsset({ id: 'P1' })
  bus.addAsset({ id: 'V1', kind: 'video' })
  kept = bus.clip(clipIdOf(await bus.add({ startMs: 1000, lengthMs: 1000 })))
  bus.clearUndo()
})
afterEach(() => bus.cleanup())

const row = (over: Partial<BackgroundClipRow> = {}): BackgroundClipRow => ({
  id: 'K-new',
  variantId: bus.variantId,
  assetId: 'P1',
  startMs: 3000,
  inMs: 0,
  outMs: 1000,
  placement: null,
  soundOn: true,
  ...over,
})
const restore = (rows: BackgroundClipRow[]) => bus.user('clip.restore', { rows })
// A second variant: a copy of the first row under another ID.
const otherVariant = (): string => {
  const columns = (bus.db.prepare('SELECT * FROM variant LIMIT 1').get() as object) ?? {}
  const names = Object.keys(columns).filter((c) => c !== 'id' && c !== 'language')
  bus.db
    .prepare(
      `INSERT INTO variant (id, language, ${names.join(', ')})
       SELECT 'V-other', 'xx', ${names.join(', ')} FROM variant WHERE id = ?`,
    )
    .run(bus.variantId)
  return 'V-other'
}

describe('clip.restore', () => {
  it('puts a row back as given, sets first_clip_made and bumps rev; its inverse removes it', async () => {
    bus.db.prepare('UPDATE variant SET first_clip_made = 0').run()
    const rev = bus.variant().rev
    const given = row({ assetId: 'V1', inMs: 200, outMs: 1200, soundOn: false })
    expect(await bus.changed(() => restore([given]))).toEqual({
      ok: true,
      data: { clipIds: ['K-new'] },
    })
    expect(bus.clip('K-new')).toEqual(given)
    expect(bus.variant()).toMatchObject({ rev: rev + 1, firstClipMade: true })
    expect(await bus.history('undo')).toMatchObject({ ok: true })
    expect(bus.clips()).toEqual([kept])
  })

  it('writes rows that are there back over them, and its inverse puts them back', async () => {
    const moved = { ...kept, startMs: 6000 }
    expect(await restore([moved])).toMatchObject({ ok: true })
    expect(bus.clips()).toEqual([moved])
    expect(await bus.history('undo')).toMatchObject({ ok: true })
    expect(bus.clips()).toEqual([kept])
  })
})

describe('clip.restore refusals: each row checked as the public commands check it', () => {
  const refused = async (rows: BackgroundClipRow[], code: string, reason?: string) => {
    await expectRefused(bus, () => restore(rows), code, reason)
    expect(bus.undoState()).toEqual({ canUndo: false, canRedo: false })
  }

  it.each([
    ['startMs below 0', { startMs: -1 }],
    ['startMs past a day', { startMs: 86_400_001 }],
    ['outMs past a day', { inMs: 86_399_000, outMs: 86_400_001 }],
    ['a trim under 100 ms', { inMs: 100, outMs: 150 }],
    ['an empty asset ID', { assetId: '' }],
    [
      'a placement of width 0',
      { placement: { x: 0, y: 0, width: 0, height: 1, rotation: 0, crop: null } },
    ],
  ])('refuses %s with INVALID_INPUT', async (_, over) => {
    await refused([row(over)], 'INVALID_INPUT')
  })

  it('refuses a row that overlaps a clip on the track with clip_overlap', async () => {
    await refused([row({ startMs: 1500 })], 'RULE_VIOLATION', 'clip_overlap')
  })

  it('refuses rows that overlap each other with clip_overlap', async () => {
    const second = bus.clip(clipIdOf(await bus.add({ startMs: 5000, lengthMs: 1000 })))
    bus.clearUndo()
    const a = { ...kept, startMs: 4000 }
    const b = { ...second, startMs: 4500 }
    await refused([a, b], 'RULE_VIOLATION', 'clip_overlap')
  })

  it('refuses a video trim past its file with clip_trim_out_of_range', async () => {
    await refused(
      [row({ assetId: 'V1', inMs: 1000, outMs: 5001 })],
      'RULE_VIOLATION',
      'clip_trim_out_of_range',
    )
  })

  it.each([
    ['a font', { id: 'F1', kind: 'font' as const, mime: 'font/ttf' }],
    ['an audio file', { id: 'S1', kind: 'audio' as const, mime: 'audio/mpeg' }],
    ['a WebM video', { id: 'W1', kind: 'video' as const, mime: 'video/webm' }],
    ['a picture in the reference library', { id: 'R1', library: 'reference' as const }],
  ])('refuses a row naming %s with clip_asset_not_usable', async (_, spec) => {
    bus.addAsset(spec)
    await refused([row({ assetId: spec.id })], 'RULE_VIOLATION', 'clip_asset_not_usable')
  })

  it('refuses a row naming an asset that is not there with clip_asset_not_usable', async () => {
    await refused([row({ assetId: 'NOPE' })], 'RULE_VIOLATION', 'clip_asset_not_usable')
  })

  it('refuses a video with unusable facts with clip_video_unreadable', async () => {
    bus.addAsset({ id: 'U1', kind: 'video', facts: { width: 0, height: 360, durationMs: 5000 } })
    await refused([row({ assetId: 'U1' })], 'RULE_VIOLATION', 'clip_video_unreadable')
  })

  it('refuses a variant that is not there with NOT_FOUND', async () => {
    await refused([row({ variantId: 'no-such-variant' })], 'NOT_FOUND')
  })

  it('refuses rows of two variants with INVALID_INPUT', async () => {
    const other = row({ id: 'K-b', variantId: otherVariant() })
    await refused([row(), other], 'INVALID_INPUT')
  })

  it('refuses a row whose ID is a clip of another variant with INVALID_INPUT', async () => {
    await refused([{ ...kept, variantId: otherVariant() }], 'INVALID_INPUT')
  })

  it('refuses one ID twice with INVALID_INPUT', async () => {
    await refused([row(), row({ startMs: 6000 })], 'INVALID_INPUT')
  })

  it('refuses a mix of new rows and rows that are there with INVALID_INPUT', async () => {
    await refused([row(), { ...kept, startMs: 6000 }], 'INVALID_INPUT')
  })
})
