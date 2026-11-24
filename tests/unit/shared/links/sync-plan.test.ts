// P5-12: the sync plan (spec/links-and-sync.md, "Sync"; spec/data-rules.md [FR-082, FR-083]).
// Pure: plain rows in, the preview and the writes out.
import { describe, expect, it } from 'vitest'
import { syncPreviewOf, syncWritesOf, type SyncPlanInput } from '@/shared/links/sync-plan'
import { planVariant } from '@/shared/links/fan-out-plan'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import type { SyncDecision } from '@/shared/schemas/links'
import { layer, textStyle } from '../scene/fixtures'

const zero = { copy: 0, style: 0, geometry: 0, source: 0, timing: 0, animation: 0 }
const ahead = (over: Partial<typeof zero>) => ({ ...zero, ...over })
const square = { id: 'm', width: 1080, height: 1080, language: 'en' }
const tall = { id: 'v', width: 1080, height: 1920, language: 'en' }
const german = { id: 'v', width: 1080, height: 1080, language: 'de' }
const sameSquare = { id: 'v', width: 1080, height: 1080, language: 'en' }

const masterTitle = (over: Partial<LayerRow> = {}) =>
  layer({
    id: 'm-title',
    key: 'title',
    name: 'Title',
    type: 'text',
    variantId: 'm',
    copy: 'Hello',
    style: { ...textStyle, color: '#AA0000', fontSize: 50 },
    geometry: { x: 100, y: 100, width: 500, height: 100, rotation: 0, crop: null },
    revs: ahead({ style: 1 }),
    ...over,
  })

const variantTitle = (over: Partial<LayerRow> = {}) =>
  layer({
    id: 'v-title',
    key: 'title',
    name: 'Title',
    type: 'text',
    variantId: 'v',
    linked: true,
    copy: 'Hello',
    style: { ...textStyle, color: '#00AA00' },
    geometry: { x: 1, y: 2, width: 3, height: 4, rotation: 0, crop: null },
    ...over,
  })

function plan(
  masterLayers: LayerRow[],
  row: SyncPlanInput['variants'][number]['row'],
  layers: LayerRow[],
): SyncPlanInput {
  return {
    master: { row: square, layers: masterLayers },
    variants: [
      { row: square, layers: masterLayers },
      { row, layers },
    ],
    pictureSizes: {},
  }
}

const changesOf = (input: SyncPlanInput) => syncPreviewOf(input)[0]?.changes ?? []

describe('syncPreviewOf [FR-082]', () => {
  it('a style change gives one update with groups style and the master style', () => {
    const changes = changesOf(plan([masterTitle()], sameSquare, [variantTitle()]))
    expect(changes).toEqual([
      {
        layerKey: 'title',
        layerName: 'Title',
        kind: 'update',
        groups: ['style'],
        proposed: { style: masterTitle().style },
        blockedByOverride: [],
      },
    ])
  })

  it('an overridden style.color is blocked and proposed keeps the variant colour', () => {
    const v = variantTitle({ overrides: ['style.color'] })
    const [change] = changesOf(plan([masterTitle()], sameSquare, [v]))
    expect(change?.blockedByOverride).toEqual(['style.color'])
    expect(change?.proposed).toEqual({ style: { ...textStyle, color: '#00AA00', fontSize: 50 } })
  })

  it('geometry at another pixel size gives nothing', () => {
    const m = masterTitle({ revs: ahead({ geometry: 2 }) })
    expect(syncPreviewOf(plan([m], tall, [variantTitle()]))).toEqual([])
  })

  it('copy in another language gives the Phase 5 failed stand-in with the current text', () => {
    const m = masterTitle({ copy: 'Hi there', revs: ahead({ copy: 1 }) })
    const v = variantTitle({ copy: 'Hallo', style: m.style })
    expect(changesOf(plan([m], german, [v]))).toEqual([
      {
        layerKey: 'title',
        layerName: 'Title',
        kind: 'update',
        groups: ['copy'],
        proposed: {},
        proposedTranslation: { text: 'Hallo', status: 'failed' },
        blockedByOverride: [],
      },
    ])
  })

  it('a new master key gives add-layer with every group and the anchored geometry', () => {
    const extra = masterTitle({ id: 'm-sub', key: 'sub', name: 'Sub', revs: zero })
    const v = variantTitle({ style: masterTitle().style })
    const [planned] = planVariant({
      master: square,
      masterLayers: [extra],
      target: tall,
      pictureSize: null,
    })
    const changes = changesOf(plan([masterTitle({ revs: zero }), extra], tall, [v]))
    expect(changes).toEqual([
      {
        layerKey: 'sub',
        layerName: 'Sub',
        kind: 'add-layer',
        groups: ['copy', 'style', 'geometry', 'source', 'timing', 'animation'],
        proposed: {
          copy: 'Hello',
          style: extra.style,
          geometry: planned?.geometry,
          source: null,
          timing: extra.timing,
          animation: extra.animation,
        },
        blockedByOverride: [],
      },
    ])
    expect(planned?.geometry).toEqual({
      x: 100,
      y: 100,
      width: 500,
      height: 100,
      rotation: 0,
      crop: null,
    })
  })

  it('a layer added at another size is anchored to its nearer edges', () => {
    const extra = masterTitle({
      id: 'm-sub',
      key: 'sub',
      name: 'Sub',
      revs: zero,
      geometry: { x: 100, y: 800, width: 200, height: 100, rotation: 0, crop: null },
    })
    const v = variantTitle({ style: masterTitle().style })
    const [change] = changesOf(plan([masterTitle({ revs: zero }), extra], tall, [v]))
    expect(change?.proposed.geometry).toEqual({
      x: 100,
      y: 1640,
      width: 200,
      height: 100,
      rotation: 0,
      crop: null,
    })
  })

  it.each([
    { linked: true, expected: ['remove-layer'] },
    { linked: false, expected: [] },
  ])('a removed key with linked $linked gives $expected', ({ linked, expected }) => {
    const m = masterTitle({ revs: zero })
    const gone = variantTitle({ id: 'v-old', key: 'old', name: 'Old one', linked })
    const changes = changesOf(plan([m], sameSquare, [variantTitle({ style: m.style }), gone]))
    expect(changes.map((c) => c.kind)).toEqual(expected)
    if (linked) {
      expect(changes[0]).toMatchObject({ layerName: 'Old one', groups: [], proposed: {} })
    }
  })

  it('leaves out the master and every variant with nothing to change', () => {
    const m = masterTitle({ revs: zero })
    expect(syncPreviewOf(plan([m], sameSquare, [variantTitle({ style: m.style })]))).toEqual([])
  })
})

const decide = (over: Partial<SyncDecision> = {}): SyncDecision => ({
  variantId: 'v',
  layerKey: 'title',
  accept: true,
  overrides: [],
  ...over,
})

describe('syncWritesOf [FR-082, FR-083]', () => {
  const blocked = plan([masterTitle()], sameSquare, [variantTitle({ overrides: ['style.color'] })])

  it.each([
    { name: 'no choice', choice: [], color: '#00AA00', overrides: ['style.color'] },
    {
      name: 'keep-mine',
      choice: [{ path: 'style.color', choice: 'keep-mine' as const }],
      color: '#00AA00',
      overrides: ['style.color'],
    },
    {
      name: 'take-master',
      choice: [{ path: 'style.color', choice: 'take-master' as const }],
      color: '#AA0000',
      overrides: [],
    },
  ])('$name on a blocked style.color', ({ choice, color, overrides }) => {
    const [writes] = syncWritesOf(blocked, [decide({ overrides: choice })])
    expect(writes).toEqual({
      variantId: 'v',
      updates: [
        {
          layerId: 'v-title',
          patch: {
            style: { ...textStyle, color, fontSize: 50 },
            overrides,
            syncedRevs: masterTitle().revs,
          },
        },
      ],
      adds: [],
      removes: [],
    })
  })

  it('a refused change or no decision writes nothing', () => {
    expect(syncWritesOf(blocked, [decide({ accept: false })])).toEqual([])
    expect(syncWritesOf(blocked, [])).toEqual([])
  })

  it('a translation keeps the text and marks it missing', () => {
    const m = masterTitle({ copy: 'Hi there', revs: ahead({ copy: 1 }) })
    const input = plan([m], german, [variantTitle({ copy: 'Hallo', style: m.style })])
    expect(syncWritesOf(input, [decide()])[0]?.updates).toEqual([
      {
        layerId: 'v-title',
        patch: {
          overrides: [],
          syncedRevs: m.revs,
          translationStatus: 'missing',
          translationSource: null,
        },
      },
    ])
  })

  it('adds a layer one above the top and removes a linked one', () => {
    const m = masterTitle({ revs: zero })
    const extra = masterTitle({ id: 'm-sub', key: 'sub', name: 'Sub', revs: zero, z: 1 })
    const gone = variantTitle({ id: 'v-old', key: 'old', z: 7 })
    const input = plan([m, extra], sameSquare, [variantTitle({ style: m.style, z: 3 }), gone])
    const [writes] = syncWritesOf(input, [decide({ layerKey: 'sub' }), decide({ layerKey: 'old' })])
    expect(writes?.removes).toEqual(['v-old'])
    expect(writes?.adds).toMatchObject([{ key: 'sub', z: 8, linked: true, overrides: [] }])
  })

  it.each([
    { name: 'the master', d: decide({ variantId: 'm' }) },
    { name: 'a variant outside the plan', d: decide({ variantId: 'other' }) },
    { name: 'a key with no change', d: decide({ layerKey: 'nope' }) },
  ])('a choice for $name is INVALID_INPUT', ({ d }) => {
    expect(() => syncWritesOf(blocked, [d])).toThrow(
      expect.objectContaining({
        code: 'INVALID_INPUT',
        message: 'A sync choice does not match the changes.',
      }),
    )
  })
})
