import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { makeLayerBus, TEST_NOW, type LayerBus } from './layer-fixture'

let bus: LayerBus
beforeEach(async () => {
  bus = await makeLayerBus()
})
afterEach(() => bus.cleanup())

describe('layer.update and variant.agent_changed_at [FR-239]', () => {
  it('sent as the user: bumps variant.rev and leaves agent_changed_at null', async () => {
    expect(await bus.update(bus.ids.text, { copy: 'Mine' })).toMatchObject({ ok: true })
    expect(bus.variant()).toMatchObject({ rev: 1, agentChangedAt: null })
  })

  it("sent as the agent: bumps variant.rev and stamps agent_changed_at with the command's time", async () => {
    expect(await bus.update(bus.ids.text, { copy: 'Agent' }, 'agent')).toMatchObject({ ok: true })
    expect(bus.variant()).toMatchObject({ rev: 1, agentChangedAt: TEST_NOW })
  })

  it('sent as the agent with nothing to change: stamps nothing', async () => {
    const copy = bus.layer(bus.ids.text).copy
    expect(await bus.update(bus.ids.text, { copy }, 'agent')).toMatchObject({ ok: true })
    expect(bus.variant()).toMatchObject({ rev: 0, agentChangedAt: null })
  })
})
