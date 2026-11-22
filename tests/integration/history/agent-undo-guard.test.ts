import { describe, it, expect, afterEach } from 'vitest'
import { makeLayerBus, type LayerBus } from '../commands/layer-fixture'
import { expectRefused } from '../assets/asset-bus'
import { readWireRows } from '@/main/db/rows'
import type { LayerRow } from '@/shared/schemas/rows/layer'

let bus: LayerBus
afterEach(() => bus?.cleanup())

const LIMIT_MESSAGE =
  'This ad has too many agent changes in a row. Ask the user to look before going on.'

async function agentEdits(count: number, layerId = bus.ids.text, from = 0) {
  for (let i = 0; i < count; i++) {
    const result = await bus.update(layerId, { copy: `Agent ${from + i}` }, 'agent')
    expect(result).toMatchObject({ ok: true })
  }
}

const refusedEdit = (layerId = bus.ids.text) =>
  expectRefused(
    bus,
    () => bus.update(layerId, { copy: 'One too many' }, 'agent'),
    'RULE_VIOLATION',
    'agent_undo_limit',
  )

// What history.undo would do for an agent if policy ever let it: take the entry and replay it.
async function agentUndoReplay() {
  const scope = `variant:${bus.variantId}`
  const call = bus.undo.takeUndo(bus.projectId, scope)
  if (!call) throw new Error('an undo entry expected')
  const replay = { direction: 'undo' as const, projectId: bus.projectId, scope }
  const result = await bus.bus.execute(call.name, call.input, { actor: 'agent', replay })
  expect(result).toMatchObject({ ok: true })
}

describe('the agent undo guard [A-261, P10-15]', () => {
  it('lets 100 agent edits in a row through and refuses the 101st with nothing written', async () => {
    bus = await makeLayerBus()
    await agentEdits(100)
    const rev = bus.variant().rev
    const events = bus.events.length
    const error = await refusedEdit()
    expect(error.message).toBe(LIMIT_MESSAGE)
    expect(bus.variant().rev).toBe(rev)
    expect(bus.layer(bus.ids.text).copy).toBe('Agent 99')
    expect(bus.events.length).toBe(events)
    expect(bus.undo.agentRun(bus.projectId, `variant:${bus.variantId}`)).toBe(100)
    const last = bus.logLines().at(-1)
    expect(last).toMatchObject({ name: 'layer.update', ok: false, errorKind: 'RULE_VIOLATION' })
  })

  it('never refuses the user, and one user edit sets the count to 0', async () => {
    bus = await makeLayerBus()
    await agentEdits(100)
    expect(await bus.update(bus.ids.text, { copy: 'Mine' })).toMatchObject({ ok: true })
    await agentEdits(100, bus.ids.text, 100)
    await refusedEdit()
    for (let i = 0; i < 3; i++) {
      expect(await bus.update(bus.ids.text, { copy: `Mine ${i}` })).toMatchObject({ ok: true })
    }
  })

  it('a user undo sets the count to 0', async () => {
    bus = await makeLayerBus()
    await agentEdits(100)
    expect(await bus.history('undo')).toMatchObject({ ok: true })
    await agentEdits(100, bus.ids.text, 100)
    await refusedEdit()
  })

  it('a user redo sets the count to 0', async () => {
    bus = await makeLayerBus()
    await agentEdits(100)
    await agentUndoReplay()
    expect(await bus.history('redo')).toMatchObject({ ok: true })
    await agentEdits(100, bus.ids.text, 100)
    await refusedEdit()
  })

  it('an agent undo is denied and does not set the count to 0', async () => {
    bus = await makeLayerBus()
    await agentEdits(100)
    const scope = `variant:${bus.variantId}`
    const undo = await bus.agent('history.undo', { scope })
    expect(undo).toMatchObject({ ok: false, error: { code: 'AGENT_DENIED' } })
    await refusedEdit()
  })

  it('an agent undo replayed through the bus does not set the count to 0', async () => {
    bus = await makeLayerBus()
    await agentEdits(100)
    await agentUndoReplay()
    expect(bus.undo.agentRun(bus.projectId, `variant:${bus.variantId}`)).toBe(100)
  })

  it('keeps an agent layer delete undoable by the user, and the layer returns', async () => {
    bus = await makeLayerBus()
    const scope = `variant:${bus.variantId}`
    expect(await bus.agent('layer.delete', { layerId: bus.ids.image })).toMatchObject({
      ok: true,
    })
    await agentEdits(99)
    await refusedEdit()
    let undone = 0
    while (bus.undoState().canUndo) {
      expect(await bus.history('undo')).toMatchObject({ ok: true })
      undone++
    }
    expect(undone).toBe(100)
    expect(bus.layer(bus.ids.image)).toMatchObject({ id: bus.ids.image, type: 'image' })
    expect(bus.undo.agentRun(bus.projectId, scope)).toBe(0)
  })

  it('counts two undo lists apart', async () => {
    bus = await makeLayerBus()
    const variant = bus.variant()
    const added = await bus.user('variant.add', {
      directionId: variant.directionId,
      sizeLabel: '9x16',
      language: 'en',
      format: 'image',
    })
    expect(added).toMatchObject({ ok: true })
    const other = (readWireRows(bus.db, 'layer') as LayerRow[]).find(
      (l) => l.variantId !== bus.variantId && l.type === 'text',
    )
    if (!other) throw new Error('a text layer on the second variant expected')
    await agentEdits(100)
    await agentEdits(100, other.id)
    await refusedEdit()
    await refusedEdit(other.id)
  })
})
