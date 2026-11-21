import type { LayerRow } from '@/shared/schemas/rows/layer'
import { cleanList } from './match'
import { CHECK_MESSAGES } from './messages'
import { isShown, shownTextLayers } from './shown'
import { checked, skipped, type CheckInput, type CheckResult } from './types'

function assetsUsedBy(layer: LayerRow): string[] {
  const used = layer.source ? [layer.source.assetId] : []
  if (layer.type === 'text' && 'fontAssetId' in layer.style && layer.style.fontAssetId) {
    used.push(layer.style.fontAssetId)
  }
  return used
}

// required-assets [FR-110, A-151]: each required asset is used by a shown layer.
export function requiredAssetsCheck(input: CheckInput): CheckResult {
  const required = cleanList(input.ruleSet.requiredAssetIds)
  if (required.length === 0) {
    return skipped('required-assets', 'brand-legal', CHECK_MESSAGES.noRequiredFiles)
  }
  const shown = input.layers.filter((layer) => isShown(layer, input.variant))
  const used = new Set(shown.flatMap(assetsUsedBy))
  const findings = required
    .filter((id) => !used.has(id))
    .map((id) => ({ message: CHECK_MESSAGES.assetNotShown(input.assetNames[id] ?? id) }))
  return checked('required-assets', 'brand-legal', findings)
}

// text-colours [FR-111, A-150]: every shown text layer's colour is in the palette.
export function textColoursCheck(input: CheckInput): CheckResult {
  const palette = new Set(cleanList(input.ruleSet.palette).map((c) => c.toLowerCase()))
  if (palette.size === 0) return skipped('text-colours', 'brand-legal', CHECK_MESSAGES.emptyPalette)
  const findings = shownTextLayers(input.layers, input.variant).flatMap((layer) => {
    const colour = 'color' in layer.style ? layer.style.color : null
    if (colour === null || palette.has(colour.toLowerCase())) return []
    return [{ layerId: layer.id, message: CHECK_MESSAGES.colourOutsidePalette(layer.name, colour) }]
  })
  return checked('text-colours', 'brand-legal', findings)
}
