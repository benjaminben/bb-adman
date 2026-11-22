// P7-9: clip.update (spec/phases/phase-07.md, "Clips and the track"); its inverse is
// clip.update with the old values.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { expectRefused } from '../assets/asset-bus'
import { clipIdOf, makeClipBus, type ClipBus } from './clip-fixture'
import type { ClipAsset } from '@/main/clips/clip-asset'
import { checkClip } from '@/main/clips/write-clip'

let bus: ClipBus
let videoClip: string
let stillClip: string
beforeEach(async () => {
  bus = await makeClipBus()
  bus.addAsset({ id: 'P1' })
  bus.addAsset({ id: 'V1', kind: 'video' })
  videoClip = clipIdOf(await bus.add({ assetId: 'V1' }))
  stillClip = clipIdOf(await bus.add({ startMs: 6000, lengthMs: 1000 }))
  bus.clearUndo()
})
afterEach(() => bus.cleanup())

const update = (clipId: string, change: Record<string, unknown>) =>
  bus.user('clip.update', { clipId, ...change })
const PLACED = { x: 10, y: 20, width: 300, height: 200, rotation: 0, crop: null }

describe('clip.update', () => {
  it.each([
    ['the start', { startMs: 200 }],
    ['the trim', { inMs: 1000, outMs: 4500 }],
    ['the placement', { placement: PLACED }],
    ['the sound', { soundOn: false }],
  ])('changes %s and bumps rev', async (_, change) => {
    const rev = bus.variant().rev
    const before = bus.clip(videoClip)
    expect(await bus.changed(() => update(videoClip, change))).toEqual({
      ok: true,
      data: { clipId: videoClip },
    })
    expect(bus.clip(videoClip)).toEqual({ ...before, ...change })
    expect(bus.variant().rev).toBe(rev + 1)
  })

  it('undo puts the old values back; redo the new ones', async () => {
    const before = bus.clip(videoClip)
    await update(videoClip, { placement: PLACED, inMs: 500, soundOn: false })
    const after = bus.clip(videoClip)
    expect(await bus.changed(() => bus.history('undo'))).toMatchObject({ ok: true })
    expect(bus.clip(videoClip)).toEqual(before)
    expect(await bus.changed(() => bus.history('redo'))).toMatchObject({ ok: true })
    expect(bus.clip(videoClip)).toEqual(after)
  })

  it('writes nothing and adds no undo entry for a change equal to what is stored', async () => {
    const rev = bus.variant().rev
    expect(await update(videoClip, { startMs: 0, soundOn: true })).toMatchObject({ ok: true })
    expect(bus.variant().rev).toBe(rev)
    expect(bus.undoState()).toEqual({ canUndo: false, canRedo: false })
  })

  it('lets a still run past the variant end', async () => {
    expect(await update(stillClip, { outMs: 9000 })).toMatchObject({ ok: true })
    expect(bus.clip(stillClip).outMs).toBe(9000)
  })
})

describe('clip.update refusals', () => {
  const refused = async (
    clipId: string,
    change: Record<string, unknown>,
    code: string,
    reason?: string,
  ) => {
    await expectRefused(bus, () => update(clipId, change), code, reason)
    expect(bus.undoState()).toEqual({ canUndo: false, canRedo: false })
  }

  it.each([
    ['a start onto the next clip', { startMs: 1500 }],
    ['a trim that grows into the next clip', { inMs: 0, outMs: 5000, startMs: 1001 }],
  ])('refuses %s with clip_overlap', async (_, change) => {
    await refused(videoClip, change, 'RULE_VIOLATION', 'clip_overlap')
  })

  it('refuses a still moved onto the video with clip_overlap', async () => {
    await refused(stillClip, { startMs: 4500 }, 'RULE_VIOLATION', 'clip_overlap')
  })

  it('refuses a video trim past its file with clip_trim_out_of_range', async () => {
    await refused(videoClip, { outMs: 5001 }, 'RULE_VIOLATION', 'clip_trim_out_of_range')
  })

  it('refuses a trim left under 100 ms with INVALID_INPUT', async () => {
    await refused(videoClip, { inMs: 4950 }, 'INVALID_INPUT')
  })

  it('refuses a clip whose video facts are no longer usable with clip_video_unreadable', async () => {
    bus.db.prepare("UPDATE asset SET width = 0 WHERE id = 'V1'").run()
    await refused(videoClip, { inMs: 100 }, 'RULE_VIOLATION', 'clip_video_unreadable')
  })

  it('refuses a clip that is not there with NOT_FOUND', async () => {
    await refused('no-such-clip', { startMs: 0 }, 'NOT_FOUND')
  })
})

// Security review of P7-9: a row read back from a project file made by someone else can hold
// values the schema never lets in; clip.update refuses to write such a row back.
describe('clip.update refuses a stored row out of bounds', () => {
  it.each([
    ['a start before 0', 'start_ms', -100],
    ['a trim in before 0', 'in_ms', -100],
    ['a trim out past a day', 'out_ms', 86_400_001],
  ])('refuses %s with INVALID_INPUT', async (_, column, value) => {
    bus.db.prepare(`UPDATE background_clip SET ${column} = ? WHERE id = ?`).run(value, stillClip)
    await expectRefused(bus, () => update(stillClip, { soundOn: false }), 'INVALID_INPUT')
    expect(bus.undoState()).toEqual({ canUndo: false, canRedo: false })
  })

  // The row reader already refuses a number that is not a safe whole one, before checkClip.
  it.each([
    ['a start that is not whole', 'start_ms', 6000.5],
    ['a trim in that is not a safe integer', 'in_ms', 2 ** 53 + 2],
  ])('refuses %s and writes nothing', async (_, column, value) => {
    bus.db.prepare(`UPDATE background_clip SET ${column} = ? WHERE id = ?`).run(value, stillClip)
    await expectRefused(bus, () => update(stillClip, { soundOn: false }), 'INTERNAL')
  })

  it.each([
    ['startMs', 0.5],
    ['inMs', 2 ** 53 + 2],
    ['outMs', Number.NaN],
  ])('checkClip itself refuses a %s of %d with INVALID_INPUT', (field, value) => {
    const row = { ...bus.clip(stillClip), [field]: value }
    const still: ClipAsset = { id: 'P1', kind: 'image', durationMs: null }
    expect(() => checkClip(row, still, [])).toThrow(
      expect.objectContaining({ code: 'INVALID_INPUT' }),
    )
  })
})
