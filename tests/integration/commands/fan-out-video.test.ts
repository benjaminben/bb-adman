// P7-23 (spec/data-rules.md, "Fan-out", step 7): each new video variant gets its first clip
// from the background picture with addFirstClip; image variants get none; one undo removes the
// variants and their clips.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { SQUARE, TALL } from '../campaigns/campaign-fixture'
import { makeFanOutBus, type FanOutBus } from '../links/fan-out-fixture'
import { readWireRows } from '@/main/db/rows'
import type { BackgroundClipRow } from '@/shared/schemas/rows/background-clip'

let bus: FanOutBus
beforeEach(async () => {
  bus = await makeFanOutBus()
})
afterEach(() => bus.cleanup())

const BOTH = {
  sizes: [SQUARE.label, TALL.label],
  languages: ['en'],
  formats: ['image', 'video'],
  fits: { [TALL.label]: 'scale' },
}
const fanOut = (over: Record<string, unknown> = {}) =>
  bus.user('variant.fanOut', { directionId: bus.directionId, ...BOTH, ...over })
const clips = () => readWireRows(bus.db, 'background_clip') as BackgroundClipRow[]
const clipsOf = (variantId: string) => clips().filter((c) => c.variantId === variantId)
const ofFormat = (format: string) => bus.variants().filter((v) => v.format === format)

describe('variant.fanOut with video [P7-23]', () => {
  it('makes each new video variant one clip from 0 to its duration from the background picture', async () => {
    const result = await bus.changed(() => fanOut())
    const at = (size: string, format: string) =>
      bus.variants().find((v) => v.sizeLabel === size && v.format === format)?.id
    expect(result).toMatchObject({
      ok: true,
      data: {
        variantIds: [at(SQUARE.label, 'video'), at(TALL.label, 'image'), at(TALL.label, 'video')],
      },
    })
    const videos = ofFormat('video')
    expect(videos).toHaveLength(2)
    for (const v of videos) {
      expect(v.firstClipMade).toBe(true)
      expect(v.durationMs).toBe(bus.master().durationMs)
      expect(clipsOf(v.id)).toEqual([
        expect.objectContaining({ assetId: 'A1', startMs: 0, inMs: 0, outMs: v.durationMs }),
      ])
    }
  })

  it('gives image variants no clip', async () => {
    await fanOut()
    const images = ofFormat('image')
    expect(images).toHaveLength(1)
    expect(images[0]?.firstClipMade).toBe(false)
    expect(clipsOf(images[0]?.id ?? '')).toEqual([])
  })

  it('gives no clip when the background has no picture', async () => {
    bus.db.prepare("UPDATE layer SET source = NULL WHERE type = 'background'").run()
    await fanOut({ formats: ['video'] })
    expect(ofFormat('video')).toHaveLength(2)
    expect(ofFormat('video').every((v) => !v.firstClipMade)).toBe(true)
    expect(clips()).toEqual([])
  })

  it.each([
    ['an asset of a kind no clip takes', "UPDATE asset SET mime = 'image/gif'"],
    ['a duration past the longest ad', 'UPDATE variant SET duration_ms = 999999999999'],
  ])('makes the variants without a clip for %s', async (_name, sql) => {
    bus.db.prepare(sql).run()
    expect(await fanOut({ formats: ['video'] })).toMatchObject({ ok: true })
    expect(ofFormat('video')).toHaveLength(2)
    expect(clips()).toEqual([])
  })

  it('undoes in one step, removing the variants and their clips, and redo brings them back', async () => {
    await fanOut()
    const made = clips()
    expect(made).toHaveLength(2)
    expect(await bus.changed(() => bus.history('undo'))).toMatchObject({ ok: true })
    expect(bus.variants()).toEqual([])
    expect(clips()).toEqual([])
    expect(await bus.changed(() => bus.history('redo'))).toMatchObject({ ok: true })
    expect(clips()).toEqual(made)
    expect(ofFormat('video').every((v) => v.firstClipMade)).toBe(true)
  })

  it('skips a video variant that exists and leaves the master unchanged', async () => {
    await fanOut()
    const master = bus.master()
    const second = await fanOut()
    expect(second).toEqual({ ok: true, data: { variantIds: [], fill: [] } })
    expect(bus.master()).toEqual(master)
    expect(clipsOf(bus.masterId)).toEqual([])
  })
})

// MV-7 (spec/make-variants.md, "Making variants from a variant", "A video source").
describe('variant.fanOut from a video source [MV-7]', () => {
  const PLACEMENT = { x: 10, y: 20, width: 500, height: 400, rotation: 0, crop: null }

  // The master as a video with two clips (the second with its own placement and no sound),
  // and its sound set to none.
  function videoMaster(): void {
    bus.db
      .prepare(
        "UPDATE variant SET format = 'video', sound = 'none', first_clip_made = 1 WHERE id = ?",
      )
      .run(bus.masterId)
    const add = bus.db.prepare(
      `INSERT INTO background_clip (id, variant_id, asset_id, start_ms, in_ms, out_ms, placement,
        sound_on) VALUES (?, ?, 'A1', ?, 0, ?, ?, ?)`,
    )
    add.run('M-clip-1', bus.masterId, 0, 1000, null, 1)
    add.run('M-clip-2', bus.masterId, 1000, 1500, JSON.stringify(PLACEMENT), 0)
  }
  const copied = (variantId: string) =>
    clipsOf(variantId).map(({ assetId, startMs, inMs, outMs, placement, soundOn }) => ({
      assetId,
      startMs,
      inMs,
      outMs,
      placement,
      soundOn,
    }))
  const at = (size: string, language: string, format: string) =>
    bus
      .variants()
      .find((v) => v.sizeLabel === size && v.language === language && v.format === format)

  it("copies a video master's clips and sound, keeping placement at the same pixel size only", async () => {
    videoMaster()
    const result = await fanOut({ languages: ['en', 'de'], formats: ['video'] })
    expect(result).toMatchObject({ ok: true })
    const same = at(SQUARE.label, 'de', 'video')
    const tall = at(TALL.label, 'en', 'video')
    const want = (placement: unknown) => [
      { assetId: 'A1', startMs: 0, inMs: 0, outMs: 1000, placement: null, soundOn: true },
      { assetId: 'A1', startMs: 1000, inMs: 0, outMs: 1500, placement, soundOn: false },
    ]
    expect(copied(same?.id ?? '')).toEqual(want(PLACEMENT))
    expect(copied(tall?.id ?? '')).toEqual(want(null))
    for (const v of [same, tall]) {
      expect(v).toMatchObject({ firstClipMade: true, sound: 'none', soundAssetId: null })
    }
    expect(clipsOf(bus.masterId).map((c) => c.id)).toEqual(['M-clip-1', 'M-clip-2'])
  })

  it("copies a video variant's clips when it is the source", async () => {
    videoMaster()
    await fanOut({ sizes: [TALL.label], languages: ['en'], formats: ['video'] })
    const source = at(TALL.label, 'en', 'video')?.id ?? ''
    bus.db.prepare('DELETE FROM background_clip WHERE variant_id = ? AND start_ms > 0').run(source)
    const result = await bus.user('variant.fanOut', {
      directionId: bus.directionId,
      sourceVariantId: source,
      sizes: [TALL.label],
      languages: ['de'],
      formats: ['video'],
      fits: {},
    })
    expect(result).toMatchObject({ ok: true })
    expect(copied(source)).toEqual([
      { assetId: 'A1', startMs: 0, inMs: 0, outMs: 1000, placement: null, soundOn: true },
    ])
    expect(copied(at(TALL.label, 'de', 'video')?.id ?? '')).toEqual(copied(source))
  })

  it('gives the first clip from the picture when the video source has no clip', async () => {
    videoMaster()
    bus.db.prepare('DELETE FROM background_clip').run()
    await fanOut({ formats: ['video'] })
    const tall = at(TALL.label, 'en', 'video')
    expect(clipsOf(tall?.id ?? '')).toEqual([
      expect.objectContaining({ assetId: 'A1', startMs: 0, inMs: 0, outMs: tall?.durationMs }),
    ])
  })

  it('gives a new image variant no clip from a video source', async () => {
    videoMaster()
    await fanOut({ formats: ['image'] })
    const images = ofFormat('image')
    expect(images.length).toBeGreaterThan(0)
    for (const v of images) {
      expect(clipsOf(v.id)).toEqual([])
      expect(v).toMatchObject({ firstClipMade: false, sound: 'clips' })
    }
  })

  it('undo removes the copied clips and redo brings them back', async () => {
    videoMaster()
    await fanOut({ formats: ['video'] })
    const made = clips().filter((c) => c.variantId !== bus.masterId)
    expect(made).toHaveLength(2)
    expect(await bus.changed(() => bus.history('undo'))).toMatchObject({ ok: true })
    expect(clips().map((c) => c.variantId)).toEqual([bus.masterId, bus.masterId])
    expect(await bus.changed(() => bus.history('redo'))).toMatchObject({ ok: true })
    expect(clips().filter((c) => c.variantId !== bus.masterId)).toEqual(made)
  })
})
