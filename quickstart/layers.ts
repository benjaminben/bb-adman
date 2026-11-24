// The quickstart's layers, built with the app's own pure code: the master from the starter
// layout, the boxes of a layout call put on it, then one set of layers per language and size
// as the app's fan-out plans them. Pure: no file, no call.
import { layoutPatches } from '@/shared/generation/layout-patches'
import { planVariant, type PlannedLayer } from '@/shared/links/fan-out-plan'
import type { Size } from '@/shared/scene/background-placement'
import type { CampaignSize } from '@/shared/schemas/commands/campaign'
import type { LayoutJobBox } from '@/shared/schemas/jobs/layout-proposal'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import { withBrandColours } from '@/shared/templates/brand-colours'
import { withBrandFonts } from '@/shared/templates/brand-fonts'
import { buildMasterLayers } from '@/shared/templates/master-layers'
import { starterTemplate } from '@/shared/templates/starter'
import type { SlotFills } from '@/shared/templates/types'
import { translatedLayers } from '@/shared/translation/translated-layers'
import { isFlatLayout, type Plan } from './plan'

// The file names the layers point at: the first picture, one extended picture per size, the
// logo and the two brand fonts.
export const MASTER_ASSET = 'master'
export const fillAsset = (sizeLabel: string) => `fill-${sizeLabel}`
export const LOGO_ASSET = 'logo'
export const HEADING_FONT_ASSET = 'font-heading'
export const BODY_FONT_ASSET = 'font-body'

// Which brand files the run could read.
export type BrandParts = { logo: boolean; headingFont: boolean; bodyFont: boolean }
const NO_BRAND: BrandParts = { logo: false, headingFont: false, bodyFont: false }

export type Variant = { language: string; size: CampaignSize; layers: LayerRow[] }
export type Box = { x: number; y: number; width: number; height: number }
export type CopyItem = { key: string; text: string }

const rows = (layers: PlannedLayer[], variantId: string): LayerRow[] =>
  layers.map((layer) => ({ ...layer, id: layer.key, variantId }))

const primaryOf = (plan: Plan) => plan.languages[0] ?? ''
const firstSize = (plan: Plan) => plan.sizes[0] as CampaignSize

// The master: the brief's layout at the first size, in the main language. The headline is the
// brief's message, as in the app. A photo layout takes the first picture as its background; a
// flat-colour layout takes it in the subject spot. Then the logo in the logo spot, and the
// brand fonts and colours on the text.
export function masterLayers(plan: Plan, brand: BrandParts = NO_BRAND): LayerRow[] {
  const { brief } = plan
  const pictureSlot = isFlatLayout(plan.layout) ? 'subject-image' : 'background'
  const fills: SlotFills = {
    [pictureSlot]: { assetId: MASTER_ASSET },
    headline: { text: brief.message },
  }
  const action = (brief.callToAction ?? '').trim()
  if (action !== '') fills['call-to-action'] = { text: action }
  if (brand.logo) fills.logo = { assetId: LOGO_ASSET }
  const built = buildMasterLayers(starterTemplate, firstSize(plan), fills, plan.layout)
  const fonts = {
    heading: brand.headingFont ? HEADING_FONT_ASSET : null,
    body: brand.bodyFont ? BODY_FONT_ASSET : null,
  }
  return rows(withBrandColours(withBrandFonts(built, fonts), plan.look.colours), 'master')
}

// The boxes of one layout call, put on the text layers the way the app's window applies them.
export function withLayout(layers: LayerRow[], boxes: LayoutJobBox[]): LayerRow[] {
  const patches = new Map(layoutPatches(boxes, layers).map((p) => [p.layerId, p.patch]))
  return layers.map((layer) => {
    const patch = patches.get(layer.id)
    if (!patch) return layer
    return {
      ...layer,
      geometry: { ...layer.geometry, ...patch.geometry },
      style: { ...layer.style, ...patch.style },
    } as LayerRow
  })
}

// One variant per size and language, in the app's fan-out order: sizes, then the main language
// first, so another language copies the boxes of its size. A text layer in another language
// takes the brief's copy, or stays `missing` for the translate call.
export function planVariants(plan: Plan, master: LayerRow[], pictureSize: Size): Variant[] {
  const primary = primaryOf(plan)
  const campaign = { primaryLanguage: primary, brief: plan.brief }
  const from = { ...firstSize(plan), language: primary }
  const plans = new Map<string, PlannedLayer[]>()
  const variants: Variant[] = []
  for (const size of plan.sizes) {
    for (const language of plan.languages) {
      const planned = planVariant({
        master: from,
        masterLayers: master,
        target: { width: size.width, height: size.height, language },
        fit: 'fill',
        pictureSize,
        sameSizePlan: plans.get(size.label) ?? null,
      })
      const layers = translatedLayers(campaign, language, planned)
      if (language === primary) plans.set(size.label, layers)
      variants.push({ language, size, layers: rows(layers, `${language}-${size.label}`) })
    }
  }
  return variants
}

// Where the first picture sits in a variant of another size before it is extended.
export function fillPlacement(variant: Variant): Box | null {
  const background = variant.layers.find((l) => l.type === 'background')
  if (!background) return null
  const { x, y, width, height } = background.geometry
  return { x, y, width, height }
}

// The extended picture as the variant's background, over the whole canvas (the app's applyFill).
export function withFill(variant: Variant): Variant {
  const { width, height, label } = variant.size
  const layers = variant.layers.map((layer) =>
    layer.type === 'background'
      ? {
          ...layer,
          source: { assetId: fillAsset(label) },
          geometry: { x: 0, y: 0, width, height, rotation: 0, crop: null },
        }
      : layer,
  )
  return { ...variant, layers }
}

const isMissing = (layer: LayerRow) =>
  layer.type === 'text' && layer.translationStatus === 'missing'

// The texts of one language still to translate: each layer key once, with the main language's
// words, which the plan copied onto the layer.
export function missingItems(variants: Variant[], language: string): CopyItem[] {
  const items = new Map<string, string>()
  for (const variant of variants) {
    if (variant.language !== language) continue
    for (const layer of variant.layers) {
      if (isMissing(layer) && layer.copy && !items.has(layer.key)) items.set(layer.key, layer.copy)
    }
  }
  return [...items].map(([key, text]) => ({ key, text }))
}

// A language's translated texts, written to its `missing` layers as AI proposals.
export function withTranslations(variant: Variant, language: string, items: CopyItem[]): Variant {
  if (variant.language !== language) return variant
  const texts = new Map(items.map((item) => [item.key, item.text]))
  const layers = variant.layers.map((layer): LayerRow => {
    const text = isMissing(layer) ? texts.get(layer.key) : undefined
    if (text === undefined) return layer
    return { ...layer, copy: text, translationStatus: 'proposed', translationSource: 'ai' }
  })
  return { ...variant, layers }
}
