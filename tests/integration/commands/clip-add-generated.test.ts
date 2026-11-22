// P7-9: clip.addGenerated (spec/phases/phase-07.md, "Clips and the track", A-182): the video
// job's clip, at the first free position, of its whole file. No undo entry. A variant that is
// gone gives { clipId: null }, never a refusal.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { expectRefused } from '../assets/asset-bus'
import { clipIdOf, makeClipBus, type ClipBus } from './clip-fixture'

let bus: ClipBus
beforeEach(async () => {
  bus = await makeClipBus()
  bus.addAsset({ id: 'P1' })
  bus.addAsset({ id: 'G1', kind: 'video', origin: 'generated' })
})
afterEach(() => bus.cleanup())

const addGenerated = (over: Record<string, unknown> = {}) =>
  bus.user('clip.addGenerated', { variantId: bus.variantId, assetId: 'G1', ...over })

describe('clip.addGenerated [A-182]', () => {
  it('puts the whole clip at the first free position, sets first_clip_made, bumps rev', async () => {
    await bus.add({ lengthMs: 1000 })
    bus.clearUndo()
    bus.db.prepare('UPDATE variant SET first_clip_made = 0').run()
    const rev = bus.variant().rev
    const result = await bus.changed(() => addGenerated())
    const clip = bus.clip(clipIdOf(result))
    expect(clip).toMatchObject({ assetId: 'G1', startMs: 1000, inMs: 0, outMs: 5000 })
    expect(bus.variant()).toMatchObject({ firstClipMade: true, rev: rev + 1 })
  })

  it('adds no undo entry', async () => {
    expect(await addGenerated()).toMatchObject({ ok: true })
    expect(bus.undoState()).toEqual({ canUndo: false, canRedo: false })
  })

  it('adds the clip whatever the format of the variant', async () => {
    bus.db.prepare("UPDATE variant SET format = 'video' WHERE id = ?").run(bus.variantId)
    expect(await addGenerated()).toMatchObject({ ok: true })
    bus.db.prepare("UPDATE variant SET format = 'image' WHERE id = ?").run(bus.variantId)
    expect(await addGenerated()).toMatchObject({ ok: true })
    expect(bus.clips().map((c) => c.startMs)).toEqual([0, 5000])
  })

  it('gives clipId null and writes nothing when the variant is gone', async () => {
    const before = bus.events.length
    expect(await addGenerated({ variantId: 'gone-variant' })).toEqual({
      ok: true,
      data: { clipId: null },
    })
    expect(bus.db.prepare('SELECT COUNT(*) AS n FROM background_clip').get()).toEqual({ n: 0 })
    expect(bus.events.slice(before).filter((e) => e.name === 'project.changed')).toEqual([])
  })
})

describe('clip.addGenerated refusals', () => {
  it.each([
    ['an imported video', { id: 'I1', kind: 'video' as const }],
    ['a generated picture', { id: 'I2', origin: 'generated' as const }],
    [
      'a generated WebM',
      { id: 'I3', kind: 'video' as const, origin: 'generated' as const, mime: 'video/webm' },
    ],
    [
      'a generated video whose file is missing',
      { id: 'I4', kind: 'video' as const, origin: 'generated' as const, bytes: null },
    ],
  ])('refuses %s with clip_asset_not_usable', async (_, spec) => {
    bus.addAsset(spec)
    await expectRefused(
      bus,
      () => addGenerated({ assetId: spec.id }),
      'RULE_VIOLATION',
      'clip_asset_not_usable',
    )
  })

  it('refuses an asset that is not there with clip_asset_not_usable', async () => {
    await expectRefused(
      bus,
      () => addGenerated({ assetId: 'NOPE' }),
      'RULE_VIOLATION',
      'clip_asset_not_usable',
    )
  })
})
