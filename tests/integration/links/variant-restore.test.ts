// P5-4 (spec/links-and-sync.md, "Adding back and removing variants"): variant.restore is refused
// before any write when the snapshot no longer fits the file, and stays out of reach.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { expectRefused } from '../assets/asset-bus'
import { readSnapshot } from '@/main/links/snapshot'
import type { VariantSnapshot } from '@/shared/schemas/links'
import { makeVariantBus, V2, type VariantBus } from './variant-fixture'

let bus: VariantBus
let snapshot: VariantSnapshot
beforeEach(async () => {
  bus = await makeVariantBus()
  const read = readSnapshot(bus.db, V2)
  if (!read) throw new Error('no snapshot')
  snapshot = read
  expect(await bus.user('variant.remove', { variantIds: [V2] })).toMatchObject({ ok: true })
})
afterEach(() => bus.cleanup())

const restore = (snapshots: VariantSnapshot[]) => bus.user('variant.restore', { snapshots })
const firstLayer = () => snapshot.layers[0]?.id ?? ''

type Case = [string, () => VariantSnapshot, string, string | undefined, string]

const ALREADY = 'That variant is already there.'
const CASES: Case[] = [
  [
    'the variant ID is in use',
    () => ({
      ...snapshot,
      variant: { ...snapshot.variant, id: bus.masterId },
      layers: [],
      clips: [],
    }),
    'RULE_VIOLATION',
    'variant_exists',
    ALREADY,
  ],
  [
    'a layer ID is in use',
    () => {
      const masterLayer = bus.db
        .prepare('SELECT id FROM layer WHERE variant_id = ?')
        .get(bus.masterId) as { id: string }
      return {
        ...snapshot,
        layers: snapshot.layers.map((l, i) => (i === 0 ? { ...l, id: masterLayer.id } : l)),
      }
    },
    'RULE_VIOLATION',
    'variant_exists',
    ALREADY,
  ],
  [
    'the grid place is taken',
    () => ({
      ...snapshot,
      variant: { ...snapshot.variant, id: 'V9', sizeLabel: '1x1' },
      layers: [],
      clips: [],
    }),
    'RULE_VIOLATION',
    'variant_exists',
    ALREADY,
  ],
  [
    'the direction is gone',
    () => ({ ...snapshot, variant: { ...snapshot.variant, directionId: 'gone' } }),
    'NOT_FOUND',
    undefined,
    'That direction was not found.',
  ],
  [
    'an asset a layer names is removed',
    () => {
      bus.db.prepare("DELETE FROM background_clip WHERE asset_id = 'A1'").run()
      bus.db.prepare("DELETE FROM asset WHERE id = 'A1'").run()
      return { ...snapshot, clips: [] }
    },
    'NOT_FOUND',
    undefined,
    'A file this variant used is no longer in the project.',
  ],
  [
    'an asset a clip names is removed',
    () => {
      bus.db.prepare("DELETE FROM asset WHERE id = 'A1'").run()
      return { ...snapshot, layers: snapshot.layers.filter((l) => l.source === null) }
    },
    'NOT_FOUND',
    undefined,
    'A file this variant used is no longer in the project.',
  ],
  [
    'a layer belongs to another variant',
    () => ({
      ...snapshot,
      layers: snapshot.layers.map((l) =>
        l.id === firstLayer() ? { ...l, variantId: bus.masterId } : l,
      ),
    }),
    'INVALID_INPUT',
    undefined,
    'A row in this snapshot belongs to another variant.',
  ],
]

describe('variant.restore refusals [system]', () => {
  it.each(CASES)('refuses when %s, and writes nothing', async (_, make, code, reason, message) => {
    const input = make()
    const error = await expectRefused(bus, () => restore([input]), code, reason)
    expect(error.message).toBe(message)
  })

  it('refuses the same variant twice in one input', async () => {
    await expectRefused(
      bus,
      () => restore([snapshot, snapshot]),
      'RULE_VIOLATION',
      'variant_exists',
    )
  })

  it('writes the snapshot back whole, with remove as its inverse', async () => {
    const result = await bus.changed(() => restore([snapshot]))
    expect(result).toEqual({ ok: true, data: { variantIds: [V2] } })
    expect(readSnapshot(bus.db, V2)).toEqual(snapshot)
    expect(await bus.history('undo')).toMatchObject({ ok: true })
    expect(bus.variant(V2)).toBeNull()
  })

  it('is denied to the agent without an ask', async () => {
    expect(await bus.agent('variant.restore', { snapshots: [snapshot] })).toMatchObject({
      ok: false,
      error: { code: 'AGENT_DENIED' },
    })
    expect(bus.asked).toEqual([])
    expect(bus.variant(V2)).toBeNull()
  })
})
