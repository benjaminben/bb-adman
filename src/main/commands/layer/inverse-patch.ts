// spec/editor-commands.md, "layer.update", Inverse: the patch that puts back the stored value
// of every key the merged values change. For style and geometry it holds only the changed
// fields, for animation only the changed blocks. An empty patch means nothing changed.
// Styles are compared with their look defaults filled (LK-1), so a field set to its default on
// a row without it changes nothing, and the inverse of a field the row lacks is its default.
import { isDeepStrictEqual } from 'node:util'
import { pictureLookOf, textLookOf } from '@/shared/config/look'
import type { ImageStyle, TextStyle } from '@/shared/schemas/layer'
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

function withDefaults(row: LayerRow, style: LayerRow['style']): LayerRow['style'] {
  return row.type === 'text' ? textLookOf(style as TextStyle) : pictureLookOf(style as ImageStyle)
}

export function inversePatch(row: LayerRow, merged: MergedValues): Partial<LayerPatch> {
  const inverse: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(merged) as Array<[PatchKey, unknown]>) {
    const style = key === 'style'
    const stored: unknown = style ? withDefaults(row, row.style) : row[key]
    const next = style ? withDefaults(row, value as LayerRow['style']) : value
    if (isDeepStrictEqual(stored, next)) continue
    // style, geometry and animation are objects on every stored row and in every merge.
    inverse[key] = BY_FIELD.has(key) ? changedFields(stored as object, next as object) : stored
  }
  return inverse as Partial<LayerPatch>
}
