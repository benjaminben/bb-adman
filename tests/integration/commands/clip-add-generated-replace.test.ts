// R2E-7 (spec/phases/round-2-editor.md D5): clip.addGenerated with replaceStill puts the clip
// in the place of the background's still, in one write with one undo entry whose inverse is
// clip.swap. replaceStill false or left out: the first free position, no undo entry, as before.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { clipIdOf, makeClipBus, video, type ClipBus } from './clip-fixture'
import type { BackgroundClipRow } from '@/shared/schemas/rows/background-clip'

let bus: ClipBus
let still: BackgroundClipRow
beforeEach(async () => {
  bus = await makeClipBus()
  bus.addAsset({ id: 'P1' })
  bus.addAsset({ id: 'G1', kind: 'video', origin: 'generated' })
  bus.db
    .prepare("UPDATE layer SET source = ? WHERE variant_id = ? AND type = 'background'")
    .run(JSON.stringify({ assetId: 'P1' }), bus.variantId)
  // The still addFirstClip makes: the background's picture, to the post's end.
  still = bus.clip(clipIdOf(await bus.add({ startMs: 0 })))
  bus.clearUndo()
})
afterEach(() => bus.cleanup())

const addGenerated = (over: Record<string, unknown> = {}) =>
  bus.user('clip.addGenerated', { variantId: bus.variantId, assetId: 'G1', ...over })

describe('clip.addGenerated replacing the still [R2E-7, D5]', () => {
  it('removes the still and writes the clip at its start in one write', async () => {
    expect(still).toMatchObject({ startMs: 0, outMs: 8000 })
    const rev = bus.variant().rev
    const before = bus.events.length
    const result = await addGenerated({ replaceStill: true })
    expect(result).toEqual({
      ok: true,
      data: { clipId: expect.any(String), replacedStill: true },
    })
    const clip = bus.clip(clipIdOf(result))
    expect(bus.clips()).toEqual([clip])
    expect(clip).toMatchObject({ assetId: 'G1', startMs: 0, inMs: 0, outMs: 5000 })
    expect(bus.variant().rev).toBe(rev + 1)
    const changed = bus.events.slice(before).filter((e) => e.name === 'project.changed')
    expect(changed).toHaveLength(1)
  })

  it('undo puts the still back and removes the clip; redo swaps again', async () => {
    const clipId = clipIdOf(await addGenerated({ replaceStill: true }))
    const clip = bus.clip(clipId)
    expect(bus.undoState()).toEqual({ canUndo: true, canRedo: false })
    expect(await bus.history('undo')).toMatchObject({ ok: true })
    expect(bus.clips()).toEqual([still])
    expect(bus.undoState()).toEqual({ canUndo: false, canRedo: true })
    expect(await bus.history('redo')).toMatchObject({ ok: true })
    expect(bus.clips()).toEqual([clip])
    expect(await bus.history('undo')).toMatchObject({ ok: true })
    expect(bus.clips()).toEqual([still])
  })

  it('cuts the clip before the next clip on the track', async () => {
    bus.addAsset({ id: 'V2', kind: 'video' })
    await bus.user('clip.update', { clipId: still.id, outMs: 3000 })
    await bus.add({ assetId: 'V2', startMs: 3000, lengthMs: 1000 })
    bus.clearUndo()
    const clip = bus.clip(clipIdOf(await addGenerated({ replaceStill: true })))
    expect(clip).toMatchObject({ startMs: 0, inMs: 0, outMs: 3000 })
  })

  it('goes to the first free position when less than the shortest clip would be left', async () => {
    bus.db.prepare('UPDATE variant SET duration_ms = 50 WHERE id = ?').run(bus.variantId)
    const result = await addGenerated({ replaceStill: true })
    expect(result).toMatchObject({ ok: true, data: { replacedStill: false } })
    expect(bus.clips().map((c) => [c.assetId, c.startMs])).toEqual([
      ['P1', 0],
      ['G1', 8000],
    ])
    expect(bus.undoState()).toEqual({ canUndo: false, canRedo: false })
  })

  it('goes to the first free position when no clip is the still', async () => {
    bus.addAsset({ id: 'G2', kind: 'video', origin: 'generated', bytes: video(5000) })
    bus.db
      .prepare("UPDATE layer SET source = ? WHERE variant_id = ? AND type = 'background'")
      .run(JSON.stringify({ assetId: 'G2' }), bus.variantId)
    await bus.user('clip.update', { clipId: still.id, outMs: 1000 })
    await bus.add({ assetId: 'P1', startMs: 1000, lengthMs: 1000 })
    bus.clearUndo()
    const result = await addGenerated({ replaceStill: true })
    expect(result).toMatchObject({ ok: true, data: { replacedStill: false } })
    expect(bus.clips().map((c) => c.startMs)).toEqual([0, 1000, 2000])
  })
})

describe('clip.addGenerated without replaceStill, as before [A-182]', () => {
  it.each([[{}], [{ replaceStill: false }]])(
    '%o: the first free position, the still kept, no undo entry',
    async (over) => {
      const result = await addGenerated(over)
      expect(result).toMatchObject({ ok: true, data: { replacedStill: false } })
      expect(bus.clips().map((c) => [c.id, c.startMs])).toEqual([
        [still.id, 0],
        [clipIdOf(result), 8000],
      ])
      expect(bus.undoState()).toEqual({ canUndo: false, canRedo: false })
    },
  )
})
