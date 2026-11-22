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
