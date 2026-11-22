// P7-9: clip.reorder (spec/phases/phase-07.md, "Clips and the track", A-181): every clip of the
// variant, back to back from the earliest start in the given order; the inverse is
// clip.restore with every old row.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { expectRefused } from '../assets/asset-bus'
import { clipIdOf, makeClipBus, type ClipBus } from './clip-fixture'

let bus: ClipBus
let a: string
let b: string
let c: string
beforeEach(async () => {
  bus = await makeClipBus()
  bus.addAsset({ id: 'P1' })
  bus.addAsset({ id: 'V1', kind: 'video' })
  a = clipIdOf(await bus.add({ startMs: 1000, lengthMs: 1000 }))
  b = clipIdOf(await bus.add({ assetId: 'V1', startMs: 4000, lengthMs: 2000 }))
  c = clipIdOf(await bus.add({ startMs: 9000, lengthMs: 500 }))
  bus.clearUndo()
})
afterEach(() => bus.cleanup())

const reorder = (clipIds: string[]) =>
  bus.user('clip.reorder', { variantId: bus.variantId, clipIds })
const starts = () => bus.clips().map((x) => [x.id, x.startMs])

describe('clip.reorder [A-181]', () => {
  it('lays the clips back to back in the given order from the earliest start', async () => {
    const rev = bus.variant().rev
    expect(await bus.changed(() => reorder([c, a, b]))).toEqual({
      ok: true,
      data: { variantId: bus.variantId },
    })
    expect(starts()).toEqual([
      [c, 1000],
      [a, 1500],
      [b, 2500],
    ])
    expect(bus.variant().rev).toBe(rev + 1)
  })

  it('undo puts every clip back where it was; redo lays them out again', async () => {
    const before = bus.clips()
    await reorder([b, c, a])
    const after = bus.clips()
    expect(await bus.changed(() => bus.history('undo'))).toMatchObject({ ok: true })
    expect(bus.clips()).toEqual(before)
    expect(await bus.changed(() => bus.history('redo'))).toMatchObject({ ok: true })
    expect(bus.clips()).toEqual(after)
  })

  it('writes nothing and adds no undo entry when the layout is as stored', async () => {
    await reorder([a, b, c])
    bus.clearUndo()
    const rev = bus.variant().rev
    expect(await reorder([a, b, c])).toMatchObject({ ok: true })
    expect(bus.variant().rev).toBe(rev)
    expect(bus.undoState()).toEqual({ canUndo: false, canRedo: false })
  })
})

describe('clip.reorder refusals', () => {
  const refused = async (run: () => Promise<unknown>, code: string) => {
    await expectRefused(bus, run, code)
    expect(bus.undoState()).toEqual({ canUndo: false, canRedo: false })
  }

  it.each([
    ['a clip left out', () => [a, b]],
    ['a clip that is not there', () => [a, b, c, 'no-such-clip']],
    ['an unknown clip in place of one', () => [a, b, 'no-such-clip']],
  ])('refuses %s with INVALID_INPUT', async (_, ids) => {
    await refused(() => reorder(ids()), 'INVALID_INPUT')
  })

  it('refuses a variant that is not there with NOT_FOUND', async () => {
    await refused(
      () => bus.user('clip.reorder', { variantId: 'no-such-variant', clipIds: [a] }),
      'NOT_FOUND',
    )
  })
})

// Security review of P7-9: a row read back from a project file made by someone else can hold
// values the schema never lets in; clip.reorder refuses to write such a row back.
describe('clip.reorder refuses a stored row out of bounds', () => {
  it.each([
    ['a trim in before 0', 'in_ms', -100],
    ['a trim out past a day', 'out_ms', 86_400_001],
  ])('refuses %s with INVALID_INPUT', async (_, column, value) => {
    bus.db.prepare(`UPDATE background_clip SET ${column} = ? WHERE id = ?`).run(value, a)
    await expectRefused(bus, () => reorder([c, a, b]), 'INVALID_INPUT')
    expect(bus.undoState()).toEqual({ canUndo: false, canRedo: false })
  })

  // The row reader already refuses a number that is not a safe whole one, before checkClip.
  it('refuses a trim out that is not a safe integer and writes nothing', async () => {
    bus.db.prepare('UPDATE background_clip SET out_ms = ? WHERE id = ?').run(2 ** 53 + 2, a)
    await expectRefused(bus, () => reorder([c, a, b]), 'INTERNAL')
  })
})
