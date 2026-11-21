// The master of a direction: its variant row and its layers (spec/links-and-sync.md, "Where
// the code lives"). A read only; it never writes.
import type Database from 'better-sqlite3'
import { readWireRow } from '@/main/db/rows'
import { layersOf } from '@/main/queries/variant-reads'
import type { DirectionRow } from '@/shared/schemas/rows/direction'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import type { VariantRow } from '@/shared/schemas/rows/variant'

export type MasterOf = { variant: VariantRow; layers: LayerRow[] }

// Null when the direction or its master row is gone (a broken file). A layer row that cannot
// be read is left out without a log line: the query that reads the master's layers for its
// reply logs it, once.
export function masterOf(db: Database.Database, directionId: string): MasterOf | null {
  const direction = readWireRow(db, 'direction', { id: directionId }) as DirectionRow | null
  if (!direction) return null
  const variant = readWireRow(db, 'variant', { id: direction.masterVariantId }) as VariantRow | null
  return variant ? { variant, layers: layersOf(db, variant.id) } : null
}
