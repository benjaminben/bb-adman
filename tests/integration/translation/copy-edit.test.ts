// P6-1, A-161 (spec/phases/phase-06.md, design addition 2, "Editing an approved translation by
// other routes"): a copy edit through layer.update or layer.updateMany never leaves a
// translation approved, and the rule changes only the layer being written.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { makeLayerBus, type LayerBus } from '../commands/layer-fixture'

let bus: LayerBus
beforeEach(async () => {
  bus = await makeLayerBus()
})
afterEach(() => bus.cleanup())

function setTranslation(layerId: string, status: string | null, source: string | null) {
  bus.db
    .prepare('UPDATE layer SET translation_status = ?, translation_source = ? WHERE id = ?')
    .run(status, source, layerId)
}

const translation = (layerId: string) => {
  const { translationStatus, translationSource } = bus.layer(layerId)
  return { translationStatus, translationSource }
}

// A German variant beside the master, with a text layer of the same key, approved.
function addGermanTwin(): string {
  const db = bus.db
  db.prepare(
    `INSERT INTO variant (id, direction_id, title, width, height, size_label, language, format,
       duration_ms, duration_overridden, rev, created_by, created_at)
     SELECT 'v-de', direction_id, title, width, height, size_label, 'de', format, duration_ms,
       duration_overridden, rev, created_by, created_at FROM variant WHERE id = ?`,
  ).run(bus.variantId)
  db.prepare(
    `INSERT INTO layer (id, variant_id, key, type, slot, name, z, visible, locked, linked,
       overrides, copy, style, geometry, source, timing, animation, revs, synced_revs, overflow,
       translation_status, translation_source)
     SELECT 'text-de', 'v-de', key, type, slot, name, z, visible, locked, linked, overrides,
       'Hallo', style, geometry, source, timing, animation, revs, synced_revs, overflow,
       'approved', 'ai' FROM layer WHERE id = ?`,
  ).run(bus.ids.text)
  return 'text-de'
}

describe('a copy edit un-approves a translation [P6-1, A-161, FR-101]', () => {
  it.each([
    ['user', 'user'],
    ['agent', 'agent'],
  ] as const)('layer.update of copy as the %s leaves it proposed', async (actor, source) => {
    setTranslation(bus.ids.text, 'approved', 'ai')
    expect(await bus.update(bus.ids.text, { copy: 'Neu' }, actor)).toMatchObject({ ok: true })
    expect(translation(bus.ids.text)).toEqual({
      translationStatus: 'proposed',
      translationSource: source,
    })
    expect(bus.layer(bus.ids.text).copy).toBe('Neu')
  })

  it('layer.updateMany of copy leaves it proposed', async () => {
    setTranslation(bus.ids.text, 'approved', 'brief')
    const input = {
      variantId: bus.variantId,
      updates: [{ layerId: bus.ids.text, patch: { copy: 'Neu' } }],
    }
    expect(await bus.agent('layer.updateMany', input)).toMatchObject({ ok: true })
    expect(translation(bus.ids.text)).toEqual({
      translationStatus: 'proposed',
      translationSource: 'agent',
    })
  })

  it('leaves a null status null', async () => {
    expect(await bus.update(bus.ids.text, { copy: 'Neu' })).toMatchObject({ ok: true })
    expect(translation(bus.ids.text)).toEqual({ translationStatus: null, translationSource: null })
  })

  it('leaves an approved translation approved on a style-only edit', async () => {
    setTranslation(bus.ids.text, 'approved', 'ai')
    expect(await bus.update(bus.ids.text, { style: { fontSize: 40 } })).toMatchObject({ ok: true })
    expect(translation(bus.ids.text)).toEqual({
      translationStatus: 'approved',
      translationSource: 'ai',
    })
  })

  it('leaves an approved translation approved when the copy given is the same', async () => {
    setTranslation(bus.ids.text, 'approved', 'ai')
    const copy = bus.layer(bus.ids.text).copy
    expect(await bus.update(bus.ids.text, { copy })).toMatchObject({ ok: true })
    expect(translation(bus.ids.text).translationStatus).toBe('approved')
  })

  it("changes no other variant's layer with the same key", async () => {
    const twin = addGermanTwin()
    setTranslation(bus.ids.text, 'approved', 'ai')
    expect(await bus.update(bus.ids.text, { copy: 'Neu' }, 'agent')).toMatchObject({ ok: true })
    expect(bus.layer(twin)).toMatchObject({
      copy: 'Hallo',
      translationStatus: 'approved',
      translationSource: 'ai',
    })
  })

  it('an undo brings the text back but not the approval', async () => {
    setTranslation(bus.ids.text, 'approved', 'ai')
    const copy = bus.layer(bus.ids.text).copy
    await bus.update(bus.ids.text, { copy: 'Neu' })
    expect(await bus.history('undo')).toMatchObject({ ok: true })
    expect(bus.layer(bus.ids.text)).toMatchObject({ copy, translationStatus: 'proposed' })
  })
})
