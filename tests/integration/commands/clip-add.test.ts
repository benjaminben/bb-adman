// P7-9: clip.add (spec/phases/phase-07.md, "Clips and the track", A-180), under the four
// refusal rules of spec/testing.md.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { expectRefused } from '../assets/asset-bus'
import { clipIdOf, makeClipBus, video, type ClipBus } from './clip-fixture'

let bus: ClipBus
beforeEach(async () => {
  bus = await makeClipBus()
  bus.addAsset({ id: 'P1' })
  bus.addAsset({ id: 'V1', kind: 'video' })
})
afterEach(() => bus.cleanup())

const spans = () => bus.clips().map((c) => [c.assetId, c.startMs, c.inMs, c.outMs])

describe('clip.add [A-180]', () => {
  it('puts a still at 0 running to the variant end, sets first_clip_made and bumps rev', async () => {
    const rev = bus.variant().rev
    expect(bus.variant().firstClipMade).toBe(false)
    const result = await bus.changed(() => bus.add({}))
    const clipId = clipIdOf(result)
    expect(bus.clip(clipId)).toEqual({
      id: clipId,
      variantId: bus.variantId,
      assetId: 'P1',
      startMs: 0,
      inMs: 0,
      outMs: 8000,
      placement: null,
      soundOn: true,
    })
    expect(bus.variant()).toMatchObject({ firstClipMade: true, rev: rev + 1 })
  })

  it.each([
    ['a start: the time left to the end', { startMs: 2000 }, ['P1', 2000, 0, 6000]],
    ['a start with under 100 ms left: 3,000 ms', { startMs: 7950 }, ['P1', 7950, 0, 3000]],
    ['a start past the end: 3,000 ms', { startMs: 9000 }, ['P1', 9000, 0, 3000]],
    ['a length', { lengthMs: 1500 }, ['P1', 0, 0, 1500]],
  ])('takes %s', async (_, over, expected) => {
    expect(await bus.add(over)).toMatchObject({ ok: true })
    expect(spans()).toEqual([expected])
  })

  it('puts a video of its whole file at the first free position', async () => {
    await bus.add({ lengthMs: 1000 })
    await bus.add({ startMs: 7000, lengthMs: 1000 })
    expect(await bus.add({ assetId: 'V1' })).toMatchObject({ ok: true })
    expect(spans()).toEqual([
      ['P1', 0, 0, 1000],
      ['V1', 1000, 0, 5000],
      ['P1', 7000, 0, 1000],
    ])
  })

  it('puts a still after the last clip when the track is full to the end', async () => {
    await bus.add({})
    await bus.add({})
    expect(spans()).toEqual([
      ['P1', 0, 0, 8000],
      ['P1', 8000, 0, 3000],
    ])
  })

  it('takes a video shorter than its file, and one of exactly its file', async () => {
    expect(await bus.add({ assetId: 'V1', lengthMs: 2000 })).toMatchObject({ ok: true })
    expect(await bus.add({ assetId: 'V1', lengthMs: 5000 })).toMatchObject({ ok: true })
    expect(spans()).toEqual([
      ['V1', 0, 0, 2000],
      ['V1', 2000, 0, 5000],
    ])
  })

  it('reads and stores the facts of a video row that has none', async () => {
    bus.addAsset({ id: 'V2', kind: 'video', facts: null, bytes: video(4000) })
    const result = await bus.changed(() => bus.add({ assetId: 'V2' }))
    expect(bus.asset('V2')).toMatchObject({ width: 640, height: 360, durationMs: 4000 })
    expect(bus.clip(clipIdOf(result)).outMs).toBe(4000)
  })

  it('undo takes the clip off; redo puts the same row back', async () => {
    const clipId = clipIdOf(await bus.add({ assetId: 'V1' }))
    const row = bus.clip(clipId)
    expect(await bus.changed(() => bus.history('undo'))).toMatchObject({ ok: true })
    expect(bus.clips()).toEqual([])
    expect(await bus.changed(() => bus.history('redo'))).toMatchObject({ ok: true })
    expect(bus.clips()).toEqual([row])
  })

  it('adds a clip to an image variant too', async () => {
    expect(bus.variant().format).toBe('image')
    expect(await bus.add({})).toMatchObject({ ok: true })
  })
})

describe('clip.add refusals', () => {
  const refused = async (over: Record<string, unknown>, code: string, reason?: string) => {
    await expectRefused(bus, () => bus.add(over), code, reason)
    expect(bus.undoState()).toEqual({ canUndo: false, canRedo: false })
  }

  it('refuses a start that overlaps a clip with clip_overlap', async () => {
    await bus.add({ startMs: 1000, lengthMs: 1000 })
    bus.clearUndo()
    await refused({ startMs: 500, lengthMs: 600 }, 'RULE_VIOLATION', 'clip_overlap')
    await refused({ startMs: 1999 }, 'RULE_VIOLATION', 'clip_overlap')
  })

  it('refuses a video length past its file with clip_trim_out_of_range', async () => {
    await refused({ assetId: 'V1', lengthMs: 5001 }, 'RULE_VIOLATION', 'clip_trim_out_of_range')
  })

  it('refuses a video file shorter than the shortest clip with clip_trim_out_of_range', async () => {
    bus.addAsset({ id: 'V9', kind: 'video', facts: { width: 64, height: 64, durationMs: 50 } })
    await refused({ assetId: 'V9' }, 'RULE_VIOLATION', 'clip_trim_out_of_range')
  })

  it.each([
    ['an asset that is not there', { id: 'other' }, 'NOPE'],
    ['a WebM video', { id: 'W1', kind: 'video', mime: 'video/webm' }, 'W1'],
    ['a picture in the reference library', { id: 'R1', library: 'reference' }, 'R1'],
    ['a video in the reference library', { id: 'R2', kind: 'video', library: 'reference' }, 'R2'],
    ['a font', { id: 'F1', kind: 'font', mime: 'font/ttf' }, 'F1'],
    ['an audio file', { id: 'S1', kind: 'audio', mime: 'audio/mpeg' }, 'S1'],
    ['a text file', { id: 'T1', kind: 'text', mime: 'text/plain' }, 'T1'],
    ['a picture whose file is missing', { id: 'M1', bytes: null }, 'M1'],
    ['a video whose file is missing', { id: 'M2', kind: 'video', bytes: null }, 'M2'],
  ] as const)('refuses %s with clip_asset_not_usable', async (_, spec, assetId) => {
    bus.addAsset(spec)
    await refused({ assetId }, 'RULE_VIOLATION', 'clip_asset_not_usable')
  })

  const text = new TextEncoder().encode('not a video at all')
  it.each([
    ['no facts and a file that is not a video', { facts: null, bytes: text }],
    ['a width of 0', { facts: { width: 0, height: 360, durationMs: 5000 } }],
    ['a height of 0', { facts: { width: 640, height: 0, durationMs: 5000 } }],
    ['a width but no length', { facts: { width: 640, height: 360, durationMs: null } }],
    ['a length past a day', { facts: { width: 640, height: 360, durationMs: 86_400_001 } }],
    ['a length of 0', { facts: { width: 640, height: 360, durationMs: 0 } }],
  ])('refuses a video with %s with clip_video_unreadable', async (_, spec) => {
    bus.addAsset({ id: 'U1', kind: 'video', ...spec })
    await refused({ assetId: 'U1' }, 'RULE_VIOLATION', 'clip_video_unreadable')
  })

  it('refuses a variant that is not there with NOT_FOUND', async () => {
    await refused({ variantId: 'no-such-variant' }, 'NOT_FOUND')
  })

  it('refuses a start past a day with INVALID_INPUT', async () => {
    await refused({ startMs: 86_400_001 }, 'INVALID_INPUT')
  })
})
