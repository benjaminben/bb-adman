// spec/editor.md, "The variant store": loads variant.get, applies project.changed and
// asset.changedOnDisk for its variant, drops a stale reply, and keeps the draft.
import { describe, expect, it, vi } from 'vitest'
import { createVariantStore } from '@/renderer/stores/variant-store'
import type { VariantGet } from '@/shared/schemas/queries/variant'
import type { Result } from '@/shared/schemas/result'
import { makeFakeApi } from '../fake-api'
import { BACKGROUND, HEADLINE, LOGO, P, V, assetRow, variantGet } from '../editor/editor-fixture'

function setUp(reply: VariantGet = variantGet()) {
  const fake = makeFakeApi()
  fake.onQuery('variant.get', () => ({ ok: true, data: reply }))
  const store = createVariantStore(fake.api, P, V)
  store.getState().subscribe()
  return { fake, store }
}

const gets = (fake: ReturnType<typeof makeFakeApi>) =>
  fake.queries.filter((q) => q.name === 'variant.get')

const changed = (changes: object, removed: object = {}, projectId = P) => ({
  projectId,
  changed: changes,
  removed,
  actor: 'user' as const,
})

describe('variant store [spec/editor.md "The variant store"]', () => {
  it('loads variant.get: the variant row, campaign, layers by ID and assets with version 0', async () => {
    const { fake, store } = setUp()
    await store.getState().load()
    const s = store.getState()
    expect(gets(fake)[0]?.input).toEqual({ projectId: P, variantId: V })
    expect(s.variant?.title).toBe('Master post')
    expect(s.campaignId).toBe('C1')
    expect(Object.keys(s.layers)).toEqual(['L0', 'L1', 'L2'])
    expect(s.assets.A1?.displayName).toBe('A1.png')
    expect(s.versions).toEqual({ A1: 0 })
  })

  it('applies project.changed for its own variant and project only', async () => {
    const { fake, store } = setUp()
    await store.getState().load()
    const { badges, isMaster, subjectIds, ...row } = variantGet().variant
    fake.emit(
      'project.changed',
      changed(
        {
          variant: [{ ...row, title: 'Summer post', rev: 8 }],
          layer: [
            { ...HEADLINE, name: 'Title' },
            { ...LOGO, id: 'X9', variantId: 'V2' },
          ],
          asset: [assetRow('A1', { displayName: 'beach.png' }), assetRow('A5')],
        },
        { layer: [LOGO.id] },
      ),
    )
    fake.emit('project.changed', changed({ layer: [{ ...HEADLINE, name: 'Elsewhere' }] }, {}, 'P2'))
    const s = store.getState()
    expect(s.variant).toMatchObject({ title: 'Summer post', rev: 8, isMaster, subjectIds, badges })
    expect(s.layers.L1?.name).toBe('Title')
    expect(Object.keys(s.layers)).toEqual(['L0', 'L1'])
    expect(s.assets.A1?.displayName).toBe('beach.png')
    expect(s.assets.A5).toBeUndefined()
    expect(gets(fake)).toHaveLength(1)
  })

  it('reads variant.get again when a changed layer names an asset it lacks', async () => {
    const { fake, store } = setUp()
    await store.getState().load()
    fake.emit('project.changed', changed({ layer: [{ ...LOGO, source: { assetId: 'A7' } }] }))
    expect(gets(fake)).toHaveLength(2)
  })

  it('drops a variant.get reply that started before an event touching the variant, and asks again', async () => {
    const fake = makeFakeApi()
    const replies: Array<(r: Result<unknown>) => void> = []
    fake.onQuery('variant.get', () => new Promise((done) => replies.push(done)))
    const store = createVariantStore(fake.api, P, V)
    store.getState().subscribe()
    const loading = store.getState().load()
    fake.emit('project.changed', changed({ layer: [{ ...HEADLINE, name: 'Fresh' }] }))
    replies[0]?.({ ok: true, data: variantGet({ layers: [BACKGROUND] }) })
    await vi.waitFor(() => expect(gets(fake)).toHaveLength(2))
    expect(store.getState().variant).toBeNull()
    replies[1]?.({ ok: true, data: variantGet() })
    await loading
    expect(Object.keys(store.getState().layers)).toEqual(['L0', 'L1', 'L2'])
  })

  it('raises the version of each held asset named by asset.changedOnDisk for its project', async () => {
    const { fake, store } = setUp()
    await store.getState().load()
    fake.emit('asset.changedOnDisk', { projectId: P, assetIds: ['A1', 'A9'] })
    fake.emit('asset.changedOnDisk', { projectId: 'P2', assetIds: ['A1'] })
    expect(store.getState().versions).toEqual({ A1: 1 })
  })

  it('keeps a draft of one layer until it is dropped', async () => {
    const { store } = setUp()
    await store.getState().load()
    store.getState().setDraft('L1', { x: 100 })
    expect(store.getState().draft).toEqual({ layerId: 'L1', geometry: { x: 100 } })
    store.getState().dropDraft()
    expect(store.getState().draft).toBeNull()
  })
})
