// P7-10b: the undo-only fields (undoClipId and redoClipId on variant.setFormat,
// durationOverridden on variant.update) are taken only while the bus replays an undo or redo.
// Outside one, from the window or an agent, they are refused and nothing is written. A redo
// after an undone clip edit makes the first clip again under its old ID.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { expectRefused } from '../assets/asset-bus'
import { makeFormatBus, type FormatBus } from './format-fixture'
import type { CommandCall } from '@/main/history/undo-lists'

let bus: FormatBus
beforeEach(async () => {
  bus = await makeFormatBus()
})
afterEach(() => bus.cleanup())

const scope = () => `variant:${bus.variantId}` as const
const send = (name: string, input: Record<string, unknown>, actor: 'user' | 'agent' = 'user') =>
  bus.bus.execute(name, { projectId: bus.projectId, variantId: bus.variantId, ...input }, { actor })
const call = (name: string, input: Record<string, unknown>): CommandCall => ({
  name,
  input: { projectId: bus.projectId, variantId: bus.variantId, ...input },
})

describe('undo-only fields outside a replay are refused [P7-10b]', () => {
  it('a hand-sent change to image with undoClipId removes no clip', async () => {
    await bus.setFormat('video')
    const [clip] = bus.clips()
    for (const actor of ['user', 'agent'] as const) {
      const sent = () => send('variant.setFormat', { format: 'image', undoClipId: clip?.id }, actor)
      await expectRefused(bus, sent, 'INVALID_INPUT')
    }
    expect(bus.variant().format).toBe('video')
    expect(bus.clips()).toEqual([clip])
  })

  it('a hand-sent change to video with redoClipId is refused', async () => {
    const sent = () => send('variant.setFormat', { format: 'video', redoClipId: 'K1' })
    await expectRefused(bus, sent, 'INVALID_INPUT')
    expect(bus.variant().format).toBe('image')
    expect(bus.clips()).toEqual([])
  })

  it('a hand-sent duration with durationOverridden is refused', async () => {
    const stored = bus.variant()
    const sent = () => send('variant.update', { durationMs: 5000, durationOverridden: true })
    await expectRefused(bus, sent, 'INVALID_INPUT')
    expect(bus.variant()).toEqual(stored)
  })
})

describe('undo-only fields during a replay [P7-10b]', () => {
  it('a replayed undoClipId of another variant is refused and keeps that clip', async () => {
    const other = bus.copyVariant()
    await bus.setFormat('video', other)
    const kept = bus.clips(other)
    bus.db.prepare("UPDATE variant SET format = 'video' WHERE id = ?").run(bus.variantId)
    const [clip] = kept
    bus.undo.record(
      bus.projectId,
      scope(),
      call('variant.setFormat', {
        format: 'image',
        undoClipId: clip?.id,
      }),
    )
    await expectRefused(bus, () => bus.history('undo'), 'INVALID_INPUT')
    expect(bus.clips(other)).toEqual(kept)
  })

  it('a replayed redoClipId that names a clip already stored is refused', async () => {
    const other = bus.copyVariant()
    await bus.setFormat('video', other)
    const kept = bus.clips(other)
    const [clip] = kept
    const redo = call('variant.setFormat', { format: 'video', redoClipId: clip?.id })
    bus.undo.recordRedo(bus.projectId, scope(), redo)
    await expectRefused(bus, () => bus.history('redo'), 'INVALID_INPUT')
    expect(bus.clips(other)).toEqual(kept)
    expect(bus.clips()).toEqual([])
    expect(bus.variant().format).toBe('image')
  })
})

describe('redo after an undone clip edit [P7-10b]', () => {
  it('redoes the format change under the same clip ID, then the trim on that clip', async () => {
    await bus.setFormat('video')
    const [made] = bus.clips()
    const clipId = made?.id
    expect(await bus.user('clip.update', { clipId, inMs: 0, outMs: 2000 })).toMatchObject({
      ok: true,
    })
    const trimmed = bus.clips()
    expect(await bus.history('undo')).toMatchObject({ ok: true })
    expect(await bus.history('undo')).toMatchObject({ ok: true })
    expect(bus.clips()).toEqual([])
    expect(await bus.history('redo')).toMatchObject({ ok: true })
    expect(bus.clips()).toEqual([made])
    expect(await bus.history('redo')).toMatchObject({ ok: true })
    expect(bus.clips()).toEqual(trimmed)
    expect(bus.clips().map((c) => [c.id, c.inMs, c.outMs])).toEqual([[clipId, 0, 2000]])
    expect(await bus.history('undo')).toMatchObject({ ok: true })
    expect(await bus.history('undo')).toMatchObject({ ok: true })
    expect(bus.clips()).toEqual([])
    expect(bus.variant()).toMatchObject({ format: 'image', firstClipMade: false })
  })
})
