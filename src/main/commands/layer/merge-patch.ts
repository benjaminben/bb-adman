// spec/editor-commands.md, "layer.update": the layer's values after a patch, with the checks
// that need the stored layer (its type and its stored style). style and geometry are merged
// field by field (crop whole), animation block by block, every other key replaced whole.
import { AppError } from '@/shared/schemas/result'
import { ImageStyle, TextStyle } from '@/shared/schemas/layer'
import type { LayerPatch } from '@/shared/schemas/commands/layer'
import type { LayerRow } from '@/shared/schemas/rows/layer'

export type PatchKey = keyof LayerPatch
export type MergedValues = Partial<Pick<LayerRow, PatchKey>>

const invalid = (message: string) => new AppError('INVALID_INPUT', message)

// Folds degrees into (-180, 180]. A result of 0 is returned as 0, never -0, so it compares
// equal to a stored 0.
export function foldRotation(degrees: number): number {
  const folded = degrees - 360 * Math.ceil((degrees - 180) / 360)
  return folded === 0 ? 0 : folded
}

// A text layer's style must stay a TextStyle and any other layer's an ImageStyle, so a field
// of the other kind is refused. A fillColor is for the background layer only (A-73).
function mergeStyle(row: LayerRow, style: NonNullable<LayerPatch['style']>): LayerRow['style'] {
  if (row.type === 'image' && 'fillColor' in style && style.fillColor != null) {
    throw invalid('Those style values do not fit this layer.')
  }
  const schema = row.type === 'text' ? TextStyle.strict() : ImageStyle.strict()
  const result = schema.safeParse({ ...row.style, ...style })
  if (!result.success) throw invalid('Those style values do not fit this layer.')
  return result.data
}

function mergeGeometry(
  stored: LayerRow['geometry'],
  geometry: NonNullable<LayerPatch['geometry']>,
): LayerRow['geometry'] {
  const merged = { ...stored, ...geometry }
  return { ...merged, rotation: foldRotation(merged.rotation) }
}

// FR-128: only a text layer may have a preset other than none.
function mergeAnimation(
  row: LayerRow,
  animation: NonNullable<LayerPatch['animation']>,
): LayerRow['animation'] {
  const blocks = [animation.entrance, animation.exit]
  if (row.type !== 'text' && blocks.some((block) => block && block.preset !== 'none')) {
    throw invalid('Only text layers can have an entrance or exit animation.')
  }
  return { ...row.animation, ...animation }
}

export function mergePatch(row: LayerRow, patch: LayerPatch): MergedValues {
  const text = row.type === 'text'
  if (patch.copy !== undefined && !text) throw invalid('Only a text layer has text.')
  if (patch.source !== undefined && text) throw invalid('A text layer has no picture.')
  const { style, geometry, animation, ...whole } = patch
  return {
    ...whole,
    ...(style ? { style: mergeStyle(row, style) } : {}),
    ...(geometry ? { geometry: mergeGeometry(row.geometry, geometry) } : {}),
    ...(animation ? { animation: mergeAnimation(row, animation) } : {}),
  }
}
