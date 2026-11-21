// P6-4 (spec/phases/phase-06.md, design addition 2, "translation.set"; A-160, A-162): writes a
// translation, proposed from whoever sent it and never approved [REQ: FR-200]; optionally the
// same text into the same-key layers of the direction's other variants in that language.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { makeTranslationBus, type TranslationBus } from './translation-fixture'

let bus: TranslationBus
let key: string
beforeEach(async () => {
  bus = await makeTranslationBus()
  key = bus.textKeys[0] as string
})
afterEach(() => bus.cleanup())

const set = (layerId: string, text: string, apply = false, actor: 'user' | 'agent' = 'user') =>
  bus[actor]('translation.set', { layerId, text, applyToSameLanguage: apply })

describe('translation.set [P6-4, FR-200]', () => {
  it.each([
    ['user', 'user'],
    ['agent', 'agent'],
  ] as const)('as the %s writes the text, proposed, from the %s', async (actor, source) => {
    const layerId = bus.id('D1', key)
    const before = bus.text(layerId)
    const rev = bus.variant('D1').rev
    const reply = await bus.changed(() => set(layerId, 'Hallo Sommer', false, actor))
    expect(reply).toEqual({ ok: true, data: { layerIds: [layerId] } })
    expect(bus.text(layerId)).toEqual({
      copy: 'Hallo Sommer',
      translationStatus: 'proposed',
      translationSource: source,
      copyRev: before.copyRev + 1,
      syncedCopyRev: bus.layer(bus.masterLayerId(key)).revs.copy,
    })
    expect(bus.variant('D1').rev).toBe(rev + 1)
  })

  it("an agent's set on an approved translation leaves it proposed from the agent, never approved", async () => {
    const ids = [bus.id('D1', key), bus.id('D2', key)]
    for (const id of ids) {
      bus.setRow(id, { copy: 'Alt', translation_status: 'approved', translation_source: 'user' })
    }
    expect(await set(ids[0] as string, 'Neu', true, 'agent')).toMatchObject({ ok: true })
    for (const id of ids) {
      expect(bus.text(id)).toMatchObject({
        copy: 'Neu',
        translationStatus: 'proposed',
        translationSource: 'agent',
      })
    }
    expect(bus.variant('D1').agentChangedAt).not.toBeNull()
  })

  it('refuses a layer in the primary language and writes nothing', async () => {
    const layerId = bus.masterLayerId(key)
    const before = bus.text(layerId)
    expect(await set(layerId, 'Hallo')).toEqual({
      ok: false,
      error: {
        code: 'RULE_VIOLATION',
        message: "This text is in the campaign's main language. Change it in the editor.",
        details: { reason: 'not_a_translation' },
      },
    })
    expect(bus.text(layerId)).toEqual(before)
  })

  it('refuses a picture layer', async () => {
    expect(await set(bus.id('D1', bus.pictureKey), 'Hallo')).toEqual({
      ok: false,
      error: { code: 'INVALID_INPUT', message: 'Translations are for text layers.' },
    })
  })

  it('refuses a layer that is not in the project', async () => {
    expect(await set('L-none', 'Hallo')).toMatchObject({
      ok: false,
      error: { code: 'NOT_FOUND', message: 'That layer was not found.' },
    })
  })

  it.each([
    ['a text over 5000 characters', { text: 'a'.repeat(5001) }],
    ['a status', { translationStatus: 'approved' }],
    ['a source', { translationSource: 'user' }],
  ])('refuses %s in the input, as the agent, and writes nothing', async (_name, extra) => {
    const layerId = bus.id('D1', key)
    const before = bus.text(layerId)
    const input = { layerId, text: 'Hallo', applyToSameLanguage: false, ...extra }
    expect(await bus.agent('translation.set', input)).toMatchObject({
      ok: false,
      error: { code: 'INVALID_INPUT' },
    })
    expect(bus.text(layerId)).toEqual(before)
  })

  it('sets synced_revs.copy to the master copy counter on a linked layer only', async () => {
    const master = bus.masterLayerId(key)
    bus.setRow(master, { revs: JSON.stringify({ ...bus.layer(master).revs, copy: 5 }) })
    await set(bus.id('D1', key), 'Hallo')
    expect(bus.text(bus.id('D1', key)).syncedCopyRev).toBe(5)
    bus.setRow(bus.id('D2', key), { linked: 0 })
    const before = bus.text(bus.id('D2', key)).syncedCopyRev
    await set(bus.id('D2', key), 'Hallo')
    expect(bus.text(bus.id('D2', key)).syncedCopyRev).toBe(before)
  })

  it('applyToSameLanguage writes the same key in the same direction and language only', async () => {
    const override = bus.id('D2', key)
    bus.setRow(override, { overrides: JSON.stringify(['copy']) })
    const untouched = [override, bus.id('F1', key), bus.id('X1', key), bus.masterLayerId(key)]
    const before = untouched.map((id) => bus.text(id))
    const reply = await set(bus.id('D1', key), 'Hallo', true)
    expect(reply).toEqual({ ok: true, data: { layerIds: [bus.id('D1', key)] } })
    expect(untouched.map((id) => bus.text(id))).toEqual(before)
  })

  it('applyToSameLanguage writes every same-language twin and leaves out unchanged ones', async () => {
    bus.db.prepare("UPDATE layer SET overrides = '[]'").run()
    const reply = await set(bus.id('D1', key), 'Hallo', true)
    expect(reply).toEqual({ ok: true, data: { layerIds: [bus.id('D1', key), bus.id('D2', key)] } })
    expect(bus.text(bus.id('D2', key))).toMatchObject({
      copy: 'Hallo',
      translationStatus: 'proposed',
    })
    const rev = bus.variant('D2').rev
    expect(await set(bus.id('D1', key), 'Hallo', true)).toEqual({
      ok: true,
      data: { layerIds: [] },
    })
    expect(bus.variant('D2').rev).toBe(rev)
  })

  it('undo restores every written layer with its status on the named variant list, and redo', async () => {
    const ids = [bus.id('D1', key), bus.id('D2', key)]
    bus.setRow(ids[1] as string, { translation_status: 'approved', translation_source: 'ai' })
    const before = ids.map((id) => bus.text(id))
    await set(ids[0] as string, 'Hallo', true)
    const after = ids.map((id) => bus.text(id))
    expect(bus.undoState('variant:D1')).toEqual({ canUndo: true, canRedo: false })
    await bus.changed(() => bus.history('undo', 'variant:D1'))
    expect(ids.map((id) => ({ ...bus.text(id), copyRev: 0 }))).toEqual(
      before.map((t) => ({ ...t, copyRev: 0 })),
    )
    expect(bus.undoState('variant:D1')).toEqual({ canUndo: false, canRedo: true })
    expect(await bus.history('redo', 'variant:D1')).toMatchObject({ ok: true })
    expect(ids.map((id) => ({ ...bus.text(id), copyRev: 0 }))).toEqual(
      after.map((t) => ({ ...t, copyRev: 0 })),
    )
    expect(bus.undoState('variant:D1')).toEqual({ canUndo: true, canRedo: false })
  })

  it('adds no undo entry when nothing changes', async () => {
    await set(bus.id('D1', key), 'Hallo')
    await bus.history('undo', 'variant:D1')
    await bus.history('redo', 'variant:D1')
    expect(await set(bus.id('D1', key), 'Hallo')).toEqual({
      ok: true,
      data: { layerIds: [] },
    })
    expect(bus.undoState('variant:D1')).toEqual({ canUndo: true, canRedo: false })
  })
})
