// P7-10, the named test (spec/testing.md): the format round trip keeps every video setting
// [D-026], on a master and on a linked variant made with rows directly. Also image to video
// (the first clip, OI-20 settled by first_clip_made), undo and redo, and the emptied track.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { makeFormatBus, type FormatBus } from './format-fixture'

let bus: FormatBus
beforeEach(async () => {
  bus = await makeFormatBus()
  bus.addAsset({ id: 'V1', kind: 'video' })
})
afterEach(() => bus.cleanup())

const PLACED = { x: 10, y: 20, width: 300, height: 200, rotation: 0, crop: null }

// Every value of the table in spec/data-rules.md, "Changing a variant's format".
function videoSettings(variantId: string) {
  const v = bus.variant(variantId)
  const layers = bus.db
    .prepare(
      `SELECT id, timing, animation, revs, synced_revs, overrides FROM layer
       WHERE variant_id = ? ORDER BY id`,
    )
    .all(variantId)
  return {
    variant: { durationMs: v.durationMs, durationOverridden: v.durationOverridden },
    clips: bus.clips(variantId),
    layers,
  }
}

// A video variant with a changed duration, the flag set, two trimmed clips (one placed) and a
// text layer with its own timing, entrance and exit and overrides on them.
async function buildVideo(variantId: string): Promise<void> {
  bus.db
    .prepare(
      `UPDATE variant SET format = 'video', duration_ms = 9000, duration_overridden = 1
       WHERE id = ?`,
    )
    .run(variantId)
  const add = (input: Record<string, unknown>) =>
    bus.user('clip.add', { variantId, ...input }) as Promise<{ data: { clipId: string } }>
  const still = (await add({ assetId: 'P1', startMs: 0, lengthMs: 2000 })).data.clipId
  const film = (await add({ assetId: 'V1', startMs: 2500, lengthMs: 3000 })).data.clipId
  await bus.user('clip.update', { clipId: still, placement: PLACED })
  await bus.user('clip.update', { clipId: film, inMs: 500, outMs: 3500, soundOn: false })
  const timing = JSON.stringify({ startMs: 1000, endMs: 7000 })
  const block = (preset: string, startMs: number) => ({ preset, startMs, durationMs: 600 })
  const animation = JSON.stringify({ entrance: block('fade', 1000), exit: block('slide', 6400) })
  const overrides = JSON.stringify(['timing', 'animation.entrance', 'animation.exit'])
  const revs = JSON.stringify({
    copy: 0,
    style: 0,
    geometry: 0,
    source: 0,
    timing: 3,
    animation: 2,
  })
  bus.db
    .prepare(
      `UPDATE layer SET timing = ?, animation = ?, overrides = ?, revs = ?, synced_revs = ?
       WHERE id = (SELECT id FROM layer WHERE variant_id = ? AND type = 'text' LIMIT 1)`,
    )
    .run(timing, animation, overrides, revs, revs, variantId)
  bus.clearUndo()
}

describe('the format round trip keeps every video setting [D-026]', () => {
  it.each(['master', 'linked'] as const)('on a %s variant', async (which) => {
    const variantId = which === 'master' ? bus.master() : bus.copyVariant()
    expect(variantId === bus.variantId).toBe(which === 'master')
    await buildVideo(variantId)
    const before = videoSettings(variantId)
    expect(before.clips).toHaveLength(2)
    const rev = bus.variant(variantId).rev
    expect(await bus.setFormat('image', variantId)).toEqual({ ok: true, data: { variantId } })
    expect(bus.variant(variantId)).toMatchObject({ format: 'image', rev: rev + 1 })
    expect(videoSettings(variantId)).toEqual(before)
    expect(await bus.setFormat('video', variantId)).toMatchObject({ ok: true })
    expect(bus.variant(variantId)).toMatchObject({ format: 'video', rev: rev + 2 })
    expect(videoSettings(variantId)).toEqual(before)
  })

  it('changes neither the other variant of the direction nor its format', async () => {
    const linked = bus.copyVariant()
    const stored = bus.variant(linked)
    await bus.setFormat('video')
    expect(bus.variant(linked)).toEqual(stored)
  })
})

describe('image to video makes the first clip [OI-20, A-180]', () => {
  it('a clip of the background picture from 0 to the duration; layers untouched', async () => {
    const layers = bus.db.prepare('SELECT * FROM layer ORDER BY id').all()
    const { durationMs, durationOverridden, rev } = bus.variant()
    await bus.changed(() => bus.setFormat('video'))
    expect(bus.clips().map((c) => [c.assetId, c.startMs, c.inMs, c.outMs])).toEqual([
      ['P1', 0, 0, durationMs],
    ])
    expect(bus.variant()).toMatchObject({
      format: 'video',
      durationMs,
      durationOverridden,
      firstClipMade: true,
      rev: rev + 1,
    })
    expect(bus.db.prepare('SELECT * FROM layer ORDER BY id').all()).toEqual(layers)
  })

  it('makes no clip when the background has no picture; the track stays black', async () => {
    bus.setSource(null)
    expect(await bus.setFormat('video')).toMatchObject({ ok: true })
    expect(bus.clips()).toEqual([])
    expect(bus.variant().firstClipMade).toBe(false)
  })

  it('an emptied track stays empty after video, image, video', async () => {
    await bus.setFormat('video')
    const [clip] = bus.clips()
    await bus.user('clip.remove', { clipId: clip?.id })
    expect(await bus.setFormat('image')).toMatchObject({ ok: true })
    expect(await bus.setFormat('video')).toMatchObject({ ok: true })
    expect(bus.clips()).toEqual([])
    expect(bus.variant().firstClipMade).toBe(true)
  })

  it('setting the stored format writes nothing, adds no entry and answers ok', async () => {
    const stored = bus.variant()
    const result = await bus.setFormat('image')
    expect(result).toEqual({ ok: true, data: { variantId: bus.variantId } })
    expect(bus.variant()).toEqual(stored)
    expect(bus.undoState()).toEqual({ canUndo: false, canRedo: false })
  })

  it('sent as the agent, works and stamps agent_changed_at [D-025]', async () => {
    expect(await bus.setFormat('video', bus.variantId, 'agent')).toMatchObject({ ok: true })
    expect(bus.variant()).toMatchObject({ format: 'video', agentChangedAt: expect.any(String) })
  })
})

describe('variant.setFormat undo and redo', () => {
  it('undo removes the clip it made and sets first_clip_made back; redo makes it again', async () => {
    await bus.setFormat('video')
    expect(await bus.history('undo')).toMatchObject({ ok: true })
    expect(bus.variant()).toMatchObject({ format: 'image', firstClipMade: false })
    expect(bus.clips()).toEqual([])
    expect(await bus.history('redo')).toMatchObject({ ok: true })
    expect(bus.variant()).toMatchObject({ format: 'video', firstClipMade: true })
    expect(bus.clips().map((c) => [c.assetId, c.startMs])).toEqual([['P1', 0]])
    expect(await bus.history('undo')).toMatchObject({ ok: true })
    expect(bus.clips()).toEqual([])
  })

  it('undo of a change that made no clip only puts the format back', async () => {
    await buildVideo(bus.variantId)
    const before = videoSettings(bus.variantId)
    await bus.setFormat('image')
    expect(await bus.history('undo')).toMatchObject({ ok: true })
    expect(bus.variant().format).toBe('video')
    expect(videoSettings(bus.variantId)).toEqual(before)
    expect(await bus.history('redo')).toMatchObject({ ok: true })
    expect(bus.variant().format).toBe('image')
    expect(videoSettings(bus.variantId)).toEqual(before)
  })

  it('undo keeps first_clip_made when another clip landed on the track meanwhile', async () => {
    await bus.setFormat('video')
    bus.addAsset({ id: 'G1', kind: 'video', origin: 'generated' })
    const landed = await bus.user('clip.addGenerated', { variantId: bus.variantId, assetId: 'G1' })
    expect(landed).toMatchObject({ ok: true })
    expect(await bus.history('undo')).toMatchObject({ ok: true })
    expect(bus.clips().map((c) => c.assetId)).toEqual(['G1'])
    expect(bus.variant()).toMatchObject({ format: 'image', firstClipMade: true })
  })
})
