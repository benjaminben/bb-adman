// spec/phases/phase-07-slices-2.md, P7-20: the variant store holds the clips from variant.get
// and applies background_clip rows and removed clip IDs from project.changed.
import { describe, expect, it } from 'vitest'
import { createVariantStore } from '@/renderer/stores/variant-store'
import type { VariantGet } from '@/shared/schemas/queries/variant'
import type { BackgroundClipRow } from '@/shared/schemas/rows/background-clip'
import { makeFakeApi } from '../fake-api'
import { P, V, assetRow, variantGet } from '../editor/editor-fixture'

const clip = (id: string, over: Partial<BackgroundClipRow> = {}): BackgroundClipRow => ({
  id,
  variantId: V,
  assetId: 'A1',
  startMs: 0,
  inMs: 0,
  outMs: 1000,
  placement: null,
  soundOn: true,
  ...over,
})

function setUp(reply: VariantGet) {
  const fake = makeFakeApi()
  fake.onQuery('variant.get', () => ({ ok: true, data: reply }))
  const store = createVariantStore(fake.api, P, V)
  store.getState().subscribe()
  return { fake, store }
}

const changed = (changes: object, removed: object = {}) => ({
  projectId: P,
  changed: changes,
  removed,
  actor: 'user' as const,
})

describe('variant store: clips [P7-20]', () => {
  it('holds the clips of variant.get by ID', async () => {
    const { store } = setUp(variantGet({ clips: [clip('K1'), clip('K2', { startMs: 2000 })] }))
    await store.getState().load()
    expect(Object.keys(store.getState().clips)).toEqual(['K1', 'K2'])
    expect(store.getState().clips.K2?.startMs).toBe(2000)
  })

  it('applies changed clip rows of its own variant and removed clip IDs', async () => {
    const { fake, store } = setUp(
      variantGet({ clips: [clip('K1'), clip('K2', { startMs: 2000 })] }),
    )
    await store.getState().load()
    fake.emit(
      'project.changed',
      changed(
        {
          background_clip: [
            clip('K1', { startMs: 500 }),
            clip('K3', { startMs: 4000 }),
            clip('K9', { variantId: 'V2' }),
          ],
        },
        { background_clip: ['K2'] },
      ),
    )
    const clips = store.getState().clips
    expect(Object.keys(clips).sort()).toEqual(['K1', 'K3'])
    expect(clips.K1?.startMs).toBe(500)
  })

  it('reads variant.get again when a clip names an asset it does not hold', async () => {
    const { fake, store } = setUp(variantGet())
    await store.getState().load()
    fake.onQuery('variant.get', () => ({
      ok: true,
      data: variantGet({
        clips: [clip('K1', { assetId: 'A7' })],
        assets: [assetRow('A1'), assetRow('A7', { kind: 'video', displayName: 'wave.mp4' })],
      }),
    }))
    fake.emit('project.changed', changed({ background_clip: [clip('K1', { assetId: 'A7' })] }))
    await expect.poll(() => store.getState().assets.A7?.displayName).toBe('wave.mp4')
    expect(store.getState().clips.K1?.assetId).toBe('A7')
  })
})
