// spec/editor-commands.md, "layer.update", Inverse: the patch that puts back the stored value
// of every key the merged values change. For style and geometry it holds only the changed
// fields, for animation only the changed blocks. An empty patch means nothing changed.
import { isDeepStrictEqual } from 'node:util'
import type { LayerPatch } from '@/shared/schemas/commands/layer'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import type { MergedValues, PatchKey } from './merge-patch'

const BY_FIELD = new Set<PatchKey>(['style', 'geometry', 'animation'])

function changedFields(stored: object, next: object): Record<string, unknown> {
  const after = new Map(Object.entries(next))
  return Object.fromEntries(
    Object.entries(stored).filter(([field, value]) => !isDeepStrictEqual(value, after.get(field))),
  )
}

export function inversePatch(row: LayerRow, merged: MergedValues): Partial<LayerPatch> {
  const inverse: Record<string, unknown> = {}
  for (const [key, next] of Object.entries(merged) as Array<[PatchKey, unknown]>) {
    const stored: unknown = row[key]
    if (isDeepStrictEqual(stored, next)) continue
    // style, geometry and animation are objects on every stored row and in every merge.
    inverse[key] = BY_FIELD.has(key) ? changedFields(stored as object, next as object) : stored
  }
  return inverse as Partial<LayerPatch>
}
