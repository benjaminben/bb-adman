import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { expectRefused } from '../assets/asset-bus'
import { makeLayerBus, TEST_NOW, type LayerBus } from './layer-fixture'

let bus: LayerBus
beforeEach(async () => {
  bus = await makeLayerBus()
})
afterEach(() => bus.cleanup())

const update = (input: Record<string, unknown>, actor: 'user' | 'agent' = 'user') =>
  bus.bus.execute(
    'variant.update',
    { projectId: bus.projectId, variantId: bus.variantId, ...input },
    { actor },
  )

describe('variant.update [FR-070]', () => {
  it('stores the trimmed title, bumps variant.rev once and names the variant row', async () => {
    const result = await bus.changed(() => update({ title: '  Summer square  ' }))
    expect(result).toEqual({ ok: true, data: { variantId: bus.variantId } })
    expect(bus.variant()).toMatchObject({ title: 'Summer square', rev: 1, agentChangedAt: null })
  })

  it('sent as the agent, stamps agent_changed_at', async () => {
    expect(await update({ title: 'Agent' }, 'agent')).toMatchObject({ ok: true })
    expect(bus.variant()).toMatchObject({ rev: 1, agentChangedAt: TEST_NOW })
  })

  it("is undone and redone on the variant's list", async () => {
    const old = bus.variant().title
    await update({ title: 'New' })
    expect(await bus.history('undo')).toMatchObject({ ok: true })
    expect(bus.variant().title).toBe(old)
    expect(await bus.history('redo')).toMatchObject({ ok: true })
    expect(bus.variant().title).toBe('New')
  })

  it('changes nothing for the stored title, and still answers ok', async () => {
    const stored = bus.variant()
    const result = await bus.changed(() => update({ title: ` ${stored.title}` }))
    expect(result).toEqual({ ok: true, data: { variantId: bus.variantId } })
    expect(bus.variant()).toEqual(stored)
    expect(bus.undoState()).toEqual({ canUndo: false, canRedo: false })
  })

  it('answers NOT_FOUND for a variant the project does not hold', async () => {
    const error = await expectRefused(
      bus,
      () => update({ variantId: 'gone', title: 'A' }),
      'NOT_FOUND',
    )
    expect(error.message).toBe('That variant was not found.')
    expect(bus.undoState()).toEqual({ canUndo: false, canRedo: false })
  })

  it.each<Record<string, unknown>>([{ title: '  ' }, { title: 'x'.repeat(201) }, {}])(
    'refuses %j with INVALID_INPUT',
    async (input) => {
      await expectRefused(bus, () => update(input), 'INVALID_INPUT')
    },
  )
})
