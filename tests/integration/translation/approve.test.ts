// P6-4 (spec/phases/phase-06.md, design addition 2, "translation.approve"; A-159, A-160):
// approves proposed translations, refuses all when one is missing, changes no layer counter
// and makes the last check stale. Undo on the campaign list.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { denialMessage } from '@/main/commands/agent-policy'

import { addLinkedVariant, copyRow } from '../links/linked-fixture'
import { makeTranslationBus, type TranslationBus } from './translation-fixture'

let bus: TranslationBus
let key: string
beforeEach(async () => {
  bus = await makeTranslationBus()
  key = bus.textKeys[0] as string
})
afterEach(() => bus.cleanup())

const approve = (layerIds: string[]) => bus.user('translation.approve', { layerIds })
const propose = (id: string) =>
  bus.setRow(id, { copy: 'Hallo', translation_status: 'proposed', translation_source: 'ai' })

describe('translation.approve [P6-4, A-159]', () => {
  it('approves one, keeping its source and every layer counter', async () => {
    const id = bus.id('D1', key)
    propose(id)
    const before = bus.layer(id)
    const rev = bus.variant('D1').rev
    expect(await bus.changed(() => approve([id]))).toEqual({ ok: true, data: { layerIds: [id] } })
    expect(bus.layer(id)).toEqual({ ...before, translationStatus: 'approved' })
    expect(bus.variant('D1').rev).toBe(rev + 1)
  })

  it('approves many, leaves an approved one and bumps each changed variant once', async () => {
    const ids = [bus.id('D1', key), bus.id('D2', key), bus.id('F1', key)]
    ids.forEach(propose)
    bus.setRow(ids[2] as string, { translation_status: 'approved' })
    const revs = ['D1', 'D2', 'F1'].map((v) => bus.variant(v).rev)
    expect(await approve(ids)).toEqual({ ok: true, data: { layerIds: ids.slice(0, 2) } })
    expect(ids.map((id) => bus.layer(id).translationStatus)).toEqual([
      'approved',
      'approved',
      'approved',
    ])
    expect(['D1', 'D2', 'F1'].map((v) => bus.variant(v).rev)).toEqual([
      (revs[0] as number) + 1,
      (revs[1] as number) + 1,
      revs[2],
    ])
  })

  it('refuses all when one is missing, naming the missing ones, and writes nothing', async () => {
    const ids = [bus.id('D1', key), bus.id('D2', key)]
    propose(ids[0] as string)
    const before = ids.map((id) => bus.layer(id))
    expect(await approve(ids)).toEqual({
      ok: false,
      error: {
        code: 'RULE_VIOLATION',
        message: 'Some of these have no translation yet.',
        details: { reason: 'translation_missing', layerIds: [ids[1]] },
      },
    })
    expect(ids.map((id) => bus.layer(id))).toEqual(before)
  })

  it.each([
    ['a layer in the primary language', 'master', { details: { reason: 'not_a_translation' } }],
    ['a picture layer', 'picture', { code: 'INVALID_INPUT' }],
    ['a layer not in the project', 'none', { code: 'NOT_FOUND' }],
  ])('refuses %s', async (_name, which, error) => {
    const id =
      which === 'master'
        ? bus.masterLayerId(key)
        : which === 'picture'
          ? bus.id('D1', bus.pictureKey)
          : 'L-none'
    expect(await approve([id])).toMatchObject({ ok: false, error })
  })

  it('undo puts the proposed status back on the campaign list, and redo approves again', async () => {
    const ids = [bus.id('D1', key), bus.id('D2', key)]
    ids.forEach(propose)
    await approve(ids)
    expect(bus.undoState(bus.campaignScope)).toEqual({ canUndo: true, canRedo: false })
    expect(bus.undoState('variant:D1')).toEqual({ canUndo: false, canRedo: false })
    await bus.changed(() => bus.history('undo', bus.campaignScope))
    expect(ids.map((id) => bus.layer(id).translationStatus)).toEqual(['proposed', 'proposed'])
    expect(bus.undoState(bus.campaignScope)).toEqual({ canUndo: false, canRedo: true })
    expect(await bus.history('redo', bus.campaignScope)).toMatchObject({ ok: true })
    expect(ids.map((id) => bus.layer(id).translationStatus)).toEqual(['approved', 'approved'])
    expect(bus.undoState(bus.campaignScope)).toEqual({ canUndo: true, canRedo: false })
  })

  it('undo of one approval in a single variant also stays on the campaign list', async () => {
    const id = bus.id('D1', key)
    propose(id)
    await approve([id])
    await bus.history('undo', bus.campaignScope)
    expect(bus.undoState(bus.campaignScope)).toEqual({ canUndo: false, canRedo: true })
    expect(bus.undoState('variant:D1')).toEqual({ canUndo: false, canRedo: false })
  })

  it('counts a text layer with no status yet as missing', async () => {
    const id = bus.id('D1', key)
    bus.setRow(id, { translation_status: null })
    expect(await approve([id])).toMatchObject({
      ok: false,
      error: { details: { reason: 'translation_missing', layerIds: [id] } },
    })
  })

  it('refuses layers from two campaigns', async () => {
    copyRow(bus.db, 'campaign', bus.campaignId, { id: 'C2', name: 'Winter' })
    copyRow(bus.db, 'direction', bus.directionId, { id: 'dir-3', campaign_id: 'C2' })
    addLinkedVariant(bus.db, bus.masterId, 'Z1', { language: 'de' })
    bus.db.prepare("UPDATE variant SET direction_id = 'dir-3' WHERE id = 'Z1'").run()
    const ids = [bus.id('D1', key), bus.id('Z1', key)]
    ids.forEach(propose)
    expect(await approve(ids)).toEqual({
      ok: false,
      error: { code: 'INVALID_INPUT', message: 'These texts are in more than one campaign.' },
    })
    expect(ids.map((id) => bus.layer(id).translationStatus)).toEqual(['proposed', 'proposed'])
  })

  it('is denied to the agent', async () => {
    const id = bus.id('D1', key)
    propose(id)
    expect(await bus.agent('translation.approve', { layerIds: [id] })).toEqual({
      ok: false,
      error: { code: 'AGENT_DENIED', message: denialMessage('translation.approve') },
    })
    expect(bus.layer(id).translationStatus).toBe('proposed')
  })

  it('editing an approved translation sets it back to proposed', async () => {
    const id = bus.id('D1', key)
    propose(id)
    await approve([id])
    expect(
      await bus.user('translation.set', { layerId: id, text: 'Neu', applyToSameLanguage: false }),
    ).toMatchObject({ ok: true })
    expect(bus.layer(id)).toMatchObject({
      copy: 'Neu',
      translationStatus: 'proposed',
      translationSource: 'user',
    })
  })
})
