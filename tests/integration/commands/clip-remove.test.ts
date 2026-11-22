// P7-9: clip.remove (spec/phases/phase-07.md, "Clips and the track"); its inverse is
// clip.restore with the whole row.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { expectRefused } from '../assets/asset-bus'
import { clipIdOf, makeClipBus, type ClipBus } from './clip-fixture'

let bus: ClipBus
let clipId: string
beforeEach(async () => {
  bus = await makeClipBus()
  bus.addAsset({ id: 'P1' })
  bus.addAsset({ id: 'V1', kind: 'video' })
  clipId = clipIdOf(await bus.add({ assetId: 'V1' }))
  await bus.user('clip.update', {
    clipId,
    inMs: 500,
    outMs: 4000,
    soundOn: false,
    placement: { x: 1, y: 2, width: 30, height: 40, rotation: 5, crop: null },
  })
  bus.clearUndo()
})
afterEach(() => bus.cleanup())

const remove = (id = clipId) => bus.user('clip.remove', { clipId: id })

describe('clip.remove', () => {
  it('takes the clip off the track and bumps rev, leaving first_clip_made at 1', async () => {
    const rev = bus.variant().rev
    expect(await bus.changed(() => remove())).toEqual({ ok: true, data: { clipId } })
    expect(bus.clips()).toEqual([])
    expect(bus.variant()).toMatchObject({ rev: rev + 1, firstClipMade: true })
  })

  it('undo puts back every stored value; redo takes it off again', async () => {
    const row = bus.clip(clipId)
    await remove()
    const rev = bus.variant().rev
    expect(await bus.changed(() => bus.history('undo'))).toMatchObject({ ok: true })
    expect(bus.clips()).toEqual([row])
    expect(bus.variant().rev).toBe(rev + 1)
    expect(await bus.changed(() => bus.history('redo'))).toMatchObject({ ok: true })
    expect(bus.clips()).toEqual([])
  })

  it('refuses a clip that is not there with NOT_FOUND', async () => {
    const error = await expectRefused(bus, () => remove('no-such-clip'), 'NOT_FOUND')
    expect(error.message).toBe('That clip was not found.')
    expect(bus.undoState()).toEqual({ canUndo: false, canRedo: false })
  })
})
