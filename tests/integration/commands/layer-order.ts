// Test helper for the layer commands that add, remove and order layers: the variant's layers as
// stored, lowest first. Not a test file itself.
import type { LayerBus } from './layer-fixture'

type Stored = { id: string; type: string; z: number }

export function layersOf(bus: LayerBus): Stored[] {
  return bus.db
    .prepare('SELECT id, type, z FROM layer WHERE variant_id = ? ORDER BY z, id')
    .all(bus.variantId) as Stored[]
}

// The IDs of every layer but the background, lowest first.
export function orderOf(bus: LayerBus): string[] {
  return layersOf(bus)
    .filter((l) => l.type !== 'background')
    .map((l) => l.id)
}

export function zOf(bus: LayerBus): number[] {
  return layersOf(bus).map((l) => l.z)
}
