// spec/make-variants.md "Text that fits", "At creation": the layers of one new variant. The
// plan of "Links after making", then the brief's copy, then for each text layer whose pixel
// size or language differs from the source's: the pixel measures scaled, the font size fitted
// when the words changed or the box got tighter, and the override paths that gives. Pure;
// used by variant.fanOut, variant.add and the quickstart.
import type { CampaignRow } from '@/shared/schemas/rows/campaign'
import type { TextStyle } from '@/shared/schemas/layer'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import type { Size } from '@/shared/scene/background-placement'
import { translatedLayers } from '@/shared/translation/translated-layers'
import { planVariant, type PlanInput, type PlannedLayer, type VariantFacts } from './fan-out-plan'
import { fittedFontSize, measureOverrides, scaleTextMeasures } from './fit-text'

export type NewVariantInput = PlanInput & {
  campaign: Pick<CampaignRow, 'primaryLanguage' | 'brief'> // for the brief's copy
}

const smaller = (size: Size) => Math.min(size.width, size.height)

// The brief's copy goes to linked layers in a language other than the source's; the source's
// own words stay in its language, and an unlinked layer keeps its words.
function withBriefCopy(input: NewVariantInput, from: VariantFacts, planned: PlannedLayer[]) {
  const language = input.target.language
  if (language === from.language) return planned
  const linked = planned.filter((l) => l.linked)
  const translated = translatedLayers(input.campaign, language, linked)
  return planned.map((l) => (l.linked ? (translated[linked.indexOf(l)] ?? l) : l))
}

// Steps 1 to 3 of "At creation" for one text layer.
function fitted(
  layer: PlannedLayer,
  sourceLayer: LayerRow,
  masterLayer: LayerRow | null,
  k: number,
  target: Size,
): PlannedLayer {
  const style = scaleTextMeasures(layer.style as TextStyle, k)
  const was = sourceLayer.geometry
  const tighter =
    layer.geometry.width < Math.round(was.width * k) ||
    layer.geometry.height < Math.round(was.height * k)
  if (layer.copy !== sourceLayer.copy || tighter) {
    style.fontSize = fittedFontSize(layer.copy, layer.geometry, style, target)
  }
  return { ...layer, style, overrides: measureOverrides({ ...layer, style }, masterLayer) }
}

export function planNewVariant(input: NewVariantInput): PlannedLayer[] {
  const from = input.source?.facts ?? input.master
  const sourceLayers = input.source?.layers ?? input.masterLayers
  const planned = withBriefCopy(input, from, planVariant(input))
  const { target } = input
  const samePixels = from.width === target.width && from.height === target.height
  if (samePixels && from.language === target.language) return planned
  const k = smaller(target) / smaller(from)
  const masterByKey = new Map(input.masterLayers.map((l) => [l.key, l]))
  return planned.map((layer, i) => {
    const sourceLayer = sourceLayers[i]
    if (layer.type !== 'text' || !sourceLayer) return layer
    return fitted(layer, sourceLayer, masterByKey.get(layer.key) ?? null, k, target)
  })
}
