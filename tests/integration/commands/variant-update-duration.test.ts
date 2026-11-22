// P7-10: variant.update takes durationMs (spec/editor-commands.md, "variant.update"; FR-070,
// FR-120). On a variant that is not its direction's master it also sets duration_overridden;
// the inverse holds both old values.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { expectRefused } from '../assets/asset-bus'
import { makeFormatBus, TEST_NOW, type FormatBus } from './format-fixture'

let bus: FormatBus
beforeEach(async () => {
  bus = await makeFormatBus()
})
afterEach(() => bus.cleanup())

const update = (input: Record<string, unknown>, actor: 'user' | 'agent' = 'user') =>
  bus.bus.execute(
    'variant.update',
    { projectId: bus.projectId, variantId: bus.variantId, ...input },
    { actor },
  )
const durationOf = (variantId = bus.variantId) => {
  const { durationMs, durationOverridden } = bus.variant(variantId)
  return { durationMs, durationOverridden }
}

describe('variant.update durationMs [FR-120]', () => {
  it('stores the duration of the master, leaves the flag and bumps rev once', async () => {
    expect(bus.master()).toBe(bus.variantId)
    const rev = bus.variant().rev
    const result = await bus.changed(() => update({ durationMs: 12_000 }))
    expect(result).toEqual({ ok: true, data: { variantId: bus.variantId } })
    expect(bus.variant()).toMatchObject({
      durationMs: 12_000,
      durationOverridden: false,
      rev: rev + 1,
    })
  })

  it('on a variant that is not the master also sets duration_overridden', async () => {
    const linked = bus.copyVariant()
    expect(await update({ variantId: linked, durationMs: 4500 })).toMatchObject({ ok: true })
    expect(durationOf(linked)).toEqual({ durationMs: 4500, durationOverridden: true })
  })

  it('takes a title and a duration together, and undoes both at once', async () => {
    const { title } = bus.variant()
    await update({ title: 'Spring', durationMs: 7000 })
    expect(bus.variant()).toMatchObject({ title: 'Spring', durationMs: 7000 })
    expect(await bus.history('undo')).toMatchObject({ ok: true })
    expect(bus.variant()).toMatchObject({ title, durationMs: 8000 })
  })

  it('undo puts back both old values on a linked variant; redo the new ones', async () => {
    const linked = bus.copyVariant()
    await update({ variantId: linked, durationMs: 4500 })
    expect(await bus.historyOf('undo', linked)).toMatchObject({ ok: true })
    expect(durationOf(linked)).toEqual({ durationMs: 8000, durationOverridden: false })
    expect(await bus.historyOf('redo', linked)).toMatchObject({ ok: true })
    expect(durationOf(linked)).toEqual({ durationMs: 4500, durationOverridden: true })
  })

  it('keeps a flag that was already set when undone', async () => {
    const linked = bus.copyVariant()
    bus.db.prepare('UPDATE variant SET duration_overridden = 1 WHERE id = ?').run(linked)
    await update({ variantId: linked, durationMs: 4500 })
    await bus.historyOf('undo', linked)
    expect(durationOf(linked)).toEqual({ durationMs: 8000, durationOverridden: true })
  })

  it('writes nothing and adds no entry for the stored duration', async () => {
    const linked = bus.copyVariant()
    const stored = bus.variant(linked)
    expect(await update({ variantId: linked, durationMs: 8000 })).toMatchObject({ ok: true })
    expect(bus.variant(linked)).toEqual(stored)
    expect(bus.undoStateOf(linked)).toEqual({ canUndo: false, canRedo: false })
  })

  it('sent as the agent, works and stamps agent_changed_at', async () => {
    expect(await update({ durationMs: 9000 }, 'agent')).toMatchObject({ ok: true })
    expect(bus.variant()).toMatchObject({ durationMs: 9000, agentChangedAt: TEST_NOW })
  })

  it('leaves the clips as they are', async () => {
    await bus.setFormat('video')
    const clips = bus.clips()
    await update({ durationMs: 3000 })
    expect(bus.clips()).toEqual(clips)
  })
})

describe('variant.update durationMs refusals', () => {
  it.each([[499], [86_400_001], [1000.5]])('refuses %d ms with INVALID_INPUT', async (ms) => {
    await expectRefused(bus, () => update({ durationMs: ms }), 'INVALID_INPUT')
    expect(bus.undoState()).toEqual({ canUndo: false, canRedo: false })
  })

  it('answers NOT_FOUND for a variant the project does not hold', async () => {
    await expectRefused(bus, () => update({ variantId: 'gone', durationMs: 5000 }), 'NOT_FOUND')
  })

  it('refuses the flag from the agent, and the flag without a duration', async () => {
    const flag = { durationOverridden: false }
    await expectRefused(bus, () => update({ durationMs: 5000, ...flag }, 'agent'), 'INVALID_INPUT')
    await expectRefused(bus, () => update({ title: 'A', ...flag }), 'INVALID_INPUT')
  })
})
