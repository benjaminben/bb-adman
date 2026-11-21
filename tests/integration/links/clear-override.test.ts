// P5-3: layer.clearOverride removes override paths and writes the master's values; layer.revert
// sets values and lists exactly (spec/links-and-sync.md, "Overrides"; A-136).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { expectRefused } from '../assets/asset-bus'
import { makeLayerBus, type LayerBus } from '../commands/layer-fixture'
import { addLinkedVariant, linkedLayerId } from './linked-fixture'
import { denialMessage } from '@/main/commands/agent-policy'
import type { LayerRow } from '@/shared/schemas/rows/layer'

let bus: LayerBus
let record: ReturnType<typeof vi.spyOn>
let text: string
beforeEach(async () => {
  bus = await makeLayerBus()
  addLinkedVariant(bus.db, bus.variantId, 'same')
  text = linkedLayerId('same', bus.layer(bus.ids.text).key)
  bus.db.prepare('UPDATE layer SET linked = 0 WHERE id = ?').run(linkedLayerId('same', 'logo'))
  record = vi.spyOn(bus.undo, 'record')
})
afterEach(() => bus.cleanup())

const run = (name: string, input: Record<string, unknown>, actor: 'user' | 'agent' = 'user') =>
  bus.bus.execute(name, { projectId: bus.projectId, ...input }, { actor })
const clear = (layerId: string, paths: string[], actor: 'user' | 'agent' = 'user') =>
  run('layer.clearOverride', { layerId, paths }, actor)
const values = (l: LayerRow) => ({ ...l, revs: null })
const revOf = (variantId: string) =>
  (bus.db.prepare('SELECT rev FROM variant WHERE id = ?').get(variantId) as { rev: number }).rev
const edit = (patch: Record<string, unknown>) => run('layer.update', { layerId: text, patch })

describe('layer.clearOverride [spec/links-and-sync.md "Overrides"]', () => {
  it("removes style.color and writes the master's colour, other fields untouched", async () => {
    const masterColour = (bus.layer(bus.ids.text).style as { color: string }).color
    await edit({ style: { color: '#000000' } })
    await edit({ style: { fontSize: 9 } })
    const before = values(bus.layer(text))
    const rev = revOf('same')
    record.mockClear()

    const result = await bus.changed(() => clear(text, ['style.color']))
    expect(result).toEqual({ ok: true, data: { layerId: text } })
    const after = bus.layer(text)
    expect(after.overrides).toEqual(['style.fontSize'])
    expect(after.style).toEqual({ ...before.style, color: masterColour })
    expect(revOf('same')).toBe(rev + 1)
    expect(record).toHaveBeenCalledTimes(1)
    expect(record.mock.calls[0]?.[2]).toMatchObject({ name: 'layer.revert' })

    expect(await run('history.undo', { scope: 'variant:same' })).toMatchObject({ ok: true })
    expect(values(bus.layer(text))).toEqual(before)
  })

  it("writes the master's whole geometry for the geometry path", async () => {
    const masterGeometry = bus.layer(bus.ids.text).geometry
    await edit({ geometry: { x: 3, width: 20 } })
    await clear(text, ['geometry'])
    expect(bus.layer(text)).toMatchObject({ overrides: [], geometry: masterGeometry })
  })

  it('changes nothing and adds no entry for a path the layer does not hold', async () => {
    await edit({ style: { color: '#000000' } })
    const before = values(bus.layer(text))
    const rev = revOf('same')
    record.mockClear()
    expect(await clear(text, ['copy'])).toEqual({ ok: true, data: { layerId: text } })
    expect(values(bus.layer(text))).toEqual(before)
    expect(revOf('same')).toBe(rev)
    expect(record).not.toHaveBeenCalled()
  })

  it.each([
    ['an unlinked layer', () => linkedLayerId('same', 'logo')],
    ['a layer on the master', () => bus.ids.text],
  ])('refuses %s with not_linked', async (_label, id) => {
    const error = await expectRefused(
      bus,
      () => clear(id(), ['geometry']),
      'RULE_VIOLATION',
      'not_linked',
    )
    expect(error.message).toBe('This layer does not follow the master.')
  })

  it('refuses an unknown layer with NOT_FOUND', async () => {
    await expectRefused(bus, () => clear('nope', ['copy']), 'NOT_FOUND')
  })

  it('is AGENT_DENIED for the agent', async () => {
    expect(await clear(text, ['copy'], 'agent')).toEqual({
      ok: false,
      error: { code: 'AGENT_DENIED', message: denialMessage('layer.clearOverride') },
    })
  })
})

describe('layer.revert [A-136]', () => {
  it('writes the patch, sets the list exactly and bumps variant.rev once', async () => {
    const back = linkedLayerId('same', bus.layer(bus.ids.background).key)
    const rev = revOf('same')
    const layers = [
      { layerId: text, patch: { copy: 'Back' }, overrides: ['copy', 'geometry'] },
      { layerId: back, patch: {}, overrides: ['source'] },
    ]
    const result = await bus.changed(() => run('layer.revert', { variantId: 'same', layers }))
    expect(result).toEqual({ ok: true, data: { layerIds: [text, back] } })
    expect(bus.layer(text)).toMatchObject({ copy: 'Back', overrides: ['copy', 'geometry'] })
    expect(bus.layer(back).overrides).toEqual(['source'])
    expect(revOf('same')).toBe(rev + 1)
    expect(record.mock.calls.at(-1)?.[2]).toMatchObject({
      name: 'layer.revert',
      input: { variantId: 'same', layers: [{ layerId: text, overrides: [] }, { overrides: [] }] },
    })
  })

  it('writes nothing and adds no entry when nothing changes', async () => {
    const layers = [{ layerId: text, patch: {}, overrides: [] }]
    expect(await run('layer.revert', { variantId: 'same', layers })).toEqual({
      ok: true,
      data: { layerIds: [] },
    })
    expect(record).not.toHaveBeenCalled()
  })

  it('refuses a layer of another variant with NOT_FOUND', async () => {
    const layers = [{ layerId: bus.ids.text, patch: { copy: 'X' }, overrides: ['copy'] }]
    await expectRefused(bus, () => run('layer.revert', { variantId: 'same', layers }), 'NOT_FOUND')
  })
})
