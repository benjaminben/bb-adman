// The layout call (with --ai_layout only): one call on the first size moves the text to suit
// the picture, checked as the app's layout job checks it (src/main/jobs/kinds/layout-proposal.ts):
// the boxes are clamped to the canvas, then each text colour is tested against the picture.
import type { LayoutProvider } from '@/main/providers/types'
import { TYPE_STYLE_IDS, typeStylePrompt, type TypeStyleOffer } from '@/shared/config/type-styles'
import { clampLayout } from '@/shared/generation/layout-clamp'
import { LAYOUT_PICTURE_SIDE, layoutItems } from '@/shared/generation/layout-items'
import { keepReadable } from '@/shared/generation/layout-readable'
import type { SceneVariant } from '@/shared/scene/types'
import type { CampaignSize } from '@/shared/schemas/commands/campaign'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import { withLayout } from './layers'
import type { Studio } from './studio'

const DEFAULT_FONT_NAME = 'Inter'

export type LayoutOffer = {
  input: { palette: string[]; fonts: string[]; typeStyles?: TypeStyleOffer[] }
  // The type style IDs the clamp keeps; none when the call was offered none.
  typeStyles?: readonly string[]
}

// What the call is offered, as the app's job offers it: the brand colours as the palette, the
// default font and each brand font's name, and the built-in type styles only when the brief
// gives no font of its own (a font whose name cannot be read still counts as one). Pure.
export function layoutOffer(
  colours: readonly string[],
  fontNames: readonly string[],
  ownFont = fontNames.length > 0,
): LayoutOffer {
  const fonts = [...new Set([DEFAULT_FONT_NAME, ...fontNames])]
  const palette = [...colours]
  if (ownFont) return { input: { palette, fonts } }
  return { input: { palette, fonts, typeStyles: typeStylePrompt() }, typeStyles: TYPE_STYLE_IDS }
}

export type PlaceTextInput = {
  layout: LayoutProvider
  studio: Studio
  size: CampaignSize
  variant: SceneVariant
  master: LayerRow[]
  offer: LayoutOffer
  // Told when the answer holds no usable box.
  onNoBoxes(): void
}

export async function placeText(input: PlaceTextInput): Promise<LayerRow[]> {
  const { studio, size, master, offer } = input
  const { width, height } = size
  const scale = Math.min(1, LAYOUT_PICTURE_SIDE / Math.max(width, height))
  const noText = master.filter((layer) => layer.type !== 'text')
  const picture = await studio.draw(input.variant, noText, 'full', scale)
  const items = layoutItems(master)
  const answer = await input.layout.propose({
    background: { bytes: picture.png, mime: 'image/png' },
    width,
    height,
    items,
    ...offer.input,
  })
  const { palette } = offer.input
  const keys = items.map((item) => item.slot)
  const offered = offer.typeStyles ? { typeStyles: offer.typeStyles } : {}
  const boxes = clampLayout(answer, { width, height, palette, keys, ...offered })
  if (boxes.length === 0) {
    input.onNoBoxes()
    return master
  }
  const pixels = await studio.pixels(picture.png)
  const readable = keepReadable(boxes, {
    pixels,
    scale: pixels.width / width,
    palette,
    layers: master,
  })
  return withLayout(master, readable)
}
