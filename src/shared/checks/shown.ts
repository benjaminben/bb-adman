import type { LayerRow } from '@/shared/schemas/rows/layer'
import type { CheckVariant } from './types'

// A-151: the axis-aligned box of the layer after rotation about its centre (the Scene's
// transform origin is 50% 50%).
function rotatedBox(geometry: LayerRow['geometry']) {
  const radians = (geometry.rotation * Math.PI) / 180
  const cos = Math.abs(Math.cos(radians))
  const sin = Math.abs(Math.sin(radians))
  const halfWidth = (geometry.width * cos + geometry.height * sin) / 2
  const halfHeight = (geometry.width * sin + geometry.height * cos) / 2
  const centreX = geometry.x + geometry.width / 2
  const centreY = geometry.y + geometry.height / 2
  return {
    left: centreX - halfWidth,
    right: centreX + halfWidth,
    top: centreY - halfHeight,
    bottom: centreY + halfHeight,
  }
}

function overlapsCanvas(layer: LayerRow, variant: CheckVariant): boolean {
  const box = rotatedBox(layer.geometry)
  const across = Math.min(box.right, variant.width) - Math.max(box.left, 0)
  const down = Math.min(box.bottom, variant.height) - Math.max(box.top, 0)
  return across > 0 && down > 0
}

function overlapsDuration(layer: LayerRow, variant: CheckVariant): boolean {
  if (variant.format !== 'video') return true
  const end = layer.timing.endMs ?? variant.durationMs
  return Math.max(layer.timing.startMs, 0) < Math.min(end, variant.durationMs)
}

function hasContent(layer: LayerRow): boolean {
  if (layer.type === 'text') return (layer.copy ?? '').trim() !== ''
  return 'opacity' in layer.style && layer.style.opacity > 0
}

// spec/phases/phase-06.md, design addition 5, "Shown" (A-150, A-151).
export function isShown(layer: LayerRow, variant: CheckVariant): boolean {
  return (
    layer.visible &&
    hasContent(layer) &&
    overlapsCanvas(layer, variant) &&
    overlapsDuration(layer, variant)
  )
}

export function shownTextLayers(layers: LayerRow[], variant: CheckVariant): LayerRow[] {
  return layers.filter((layer) => layer.type === 'text' && isShown(layer, variant))
}
