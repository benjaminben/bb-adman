// R2E-7 (spec/phases/round-2-editor.md D5): clip.swap, the internal inverse of a generated clip
// that took a still's place. It removes the named clips and writes the rows in one write, each
// row checked as clip.restore checks it; its own inverse is the swap the other way.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { expectRefused } from '../assets/asset-bus'
import { clipIdOf, makeClipBus, type ClipBus } from './clip-fixture'
import { denialMessage } from '@/main/commands/agent-policy'
import type { BackgroundClipRow } from '@/shared/schemas/rows/background-clip'

let bus: ClipBus
let still: BackgroundClipRow
beforeEach(async () => {
  bus = await makeClipBus()
  bus.addAsset({ id: 'P1' })
  bus.addAsset({ id: 'G1', kind: 'video', origin: 'generated' })
  still = bus.clip(clipIdOf(await bus.add({ startMs: 0, lengthMs: 8000 })))
  bus.clearUndo()
})
afterEach(() => bus.cleanup())

const row = (over: Partial<BackgroundClipRow> = {}): BackgroundClipRow => ({
  id: 'K-new',
  variantId: bus.variantId,
  assetId: 'G1',
  startMs: 0,
  inMs: 0,
  outMs: 5000,
  placement: null,
  soundOn: true,
  ...over,
})
const swap = (remove: string[], put: BackgroundClipRow[], variantId = bus.variantId) =>
  bus.user('clip.swap', { variantId, remove, put })

// A second variant: a copy of the first row under another ID, with one clip of its own.
function otherVariant(): BackgroundClipRow {
  const columns = (bus.db.prepare('SELECT * FROM variant LIMIT 1').get() as object) ?? {}
  const names = Object.keys(columns).filter((c) => c !== 'id' && c !== 'language')
  bus.db
    .prepare(
      `INSERT INTO variant (id, language, ${names.join(', ')})
       SELECT 'V-other', 'xx', ${names.join(', ')} FROM variant WHERE id = ?`,
    )
    .run(bus.variantId)
  bus.db
    .prepare(
      `INSERT INTO background_clip (id, variant_id, asset_id, start_ms, in_ms, out_ms, sound_on)
       VALUES ('K-other', 'V-other', 'P1', 0, 0, 1000, 1)`,
    )
    .run()
  return bus.clip('K-other')
}

describe('clip.swap [R2E-7, D5]', () => {
  it('removes the named clips and writes the rows in one write, bumping rev once', async () => {
    const rev = bus.variant().rev
    expect(await bus.changed(() => swap([still.id], [row()]))).toEqual({
      ok: true,
      data: { clipIds: ['K-new'] },
    })
    expect(bus.clips()).toEqual([row()])
    expect(bus.variant().rev).toBe(rev + 1)
  })

  it('its inverse is the swap the other way, and that one swaps again on redo', async () => {
    await swap([still.id], [row()])
    expect(await bus.history('undo')).toMatchObject({ ok: true })
    expect(bus.clips()).toEqual([still])
    expect(await bus.history('redo')).toMatchObject({ ok: true })
    expect(bus.clips()).toEqual([row()])
  })
})

describe('clip.swap refusals: nothing written, no undo entry', () => {
  const refused = async (run: () => Promise<unknown>, code: string, reason?: string) => {
    await expectRefused(bus, run, code, reason)
    expect(bus.undoState()).toEqual({ canUndo: false, canRedo: false })
  }

  it('refuses an empty list or a clip that is not there with INVALID_INPUT', async () => {
    await refused(() => swap([], [row()]), 'INVALID_INPUT')
    await refused(() => swap([still.id], []), 'INVALID_INPUT')
    await refused(() => swap(['K-gone'], [row()]), 'INVALID_INPUT')
  })

  it('refuses a row that overlaps a clip left on the track with clip_overlap', async () => {
    const next = bus.clip(clipIdOf(await bus.add({ startMs: 8000, lengthMs: 1000 })))
    bus.clearUndo()
    await refused(() => swap([next.id], [row()]), 'RULE_VIOLATION', 'clip_overlap')
  })

  it("refuses a row naming another project's asset with clip_asset_not_usable", async () => {
    const other = await makeClipBus()
    try {
      other.addAsset({ id: 'X1', kind: 'video', origin: 'generated' })
      await refused(
        () => swap([still.id], [row({ assetId: 'X1' })]),
        'RULE_VIOLATION',
        'clip_asset_not_usable',
      )
    } finally {
      other.cleanup()
    }
  })

  it('refuses to remove a clip of another variant with INVALID_INPUT', async () => {
    const theirs = otherVariant()
    await refused(() => swap([theirs.id], [row({ startMs: 8000, outMs: 100 })]), 'INVALID_INPUT')
  })

  it('refuses a row of another variant, or one whose ID is a clip of another variant', async () => {
    const theirs = otherVariant()
    await refused(() => swap([still.id], [row({ variantId: 'V-other' })]), 'INVALID_INPUT')
    await refused(
      () => swap([still.id], [{ ...theirs, variantId: bus.variantId }]),
      'INVALID_INPUT',
    )
  })

  it('refuses a variant that is not there with NOT_FOUND', async () => {
    await refused(() => swap([still.id], [row()], 'no-such-variant'), 'NOT_FOUND')
  })

  it('refuses one ID twice with INVALID_INPUT', async () => {
    await refused(() => swap([still.id, still.id], [row()]), 'INVALID_INPUT')
    await refused(() => swap([still.id], [row(), row({ startMs: 6000 })]), 'INVALID_INPUT')
  })

  it('answers the agent AGENT_DENIED and writes nothing', async () => {
    await refused(
      () => bus.agent('clip.swap', { variantId: bus.variantId, remove: [still.id], put: [row()] }),
      'AGENT_DENIED',
    )
    const r = await bus.agent('clip.swap', { variantId: bus.variantId, remove: [], put: [] })
    expect(r).toEqual({
      ok: false,
      error: { code: 'AGENT_DENIED', message: denialMessage('clip.swap') },
    })
  })
})
