// Reads for variant.get (spec/editor-commands.md, "variant.get"). A query never writes.
import type Database from 'better-sqlite3'
import { readWireRow, readWireRows } from '@/main/db/rows'
import type { ActivityLog } from '@/main/log/activity-log'
import { AppError } from '@/shared/schemas/result'
import type { AssetRow } from '@/shared/schemas/rows/asset'
import type { DirectionRow } from '@/shared/schemas/rows/direction'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import type { VariantRow, VariantSubjectRow } from '@/shared/schemas/rows/variant'
import { namedAssetIds } from './campaign-reads'

const byId = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

export function requireVariant(
  db: Database.Database,
  variantId: string,
): { variant: VariantRow; direction: DirectionRow } {
  const variant = readWireRow(db, 'variant', { id: variantId }) as VariantRow | null
  if (!variant) throw new AppError('NOT_FOUND', 'That variant was not found.')
  const direction = readWireRow(db, 'direction', { id: variant.directionId }) as DirectionRow | null
  // A broken file: the runner answers INTERNAL and logs this line, which holds no data.
  if (!direction) throw new Error('variant.get: the variant has no direction row')
  return { variant, direction }
}

// The variant's layers, z ascending, then ID. A row that cannot be read is left out, and logged
// when a log is given.
export function layersOf(db: Database.Database, variantId: string, log?: ActivityLog): LayerRow[] {
  return (readWireRows(db, 'layer', log) as LayerRow[])
    .filter((l) => l.variantId === variantId)
    .sort((a, b) => a.z - b.z || byId(a.id, b.id))
}

export function subjectIdsOf(db: Database.Database, variantId: string, log: ActivityLog): string[] {
  return (readWireRows(db, 'variant_subject', log) as VariantSubjectRow[])
    .filter((l) => l.variantId === variantId)
    .map((l) => l.subjectId)
    .sort(byId)
}

// Each asset the layers name, once, by ID. A layer's source and font are stored as JSON with
// no foreign key, so an ID with no asset row has nothing to give and is left out.
export function assetsOf(
  db: Database.Database,
  layers: LayerRow[],
  missing: Set<string>,
): Array<AssetRow & { missing: boolean }> {
  const ids = [...new Set(layers.flatMap(namedAssetIds))].sort(byId)
  return ids.flatMap((id) => {
    const row = readWireRow(db, 'asset', { id }) as AssetRow | null
    return row ? [{ ...row, missing: missing.has(id) }] : []
  })
}
