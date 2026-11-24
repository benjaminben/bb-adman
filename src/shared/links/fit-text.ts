// spec/make-variants.md "Text that fits" and "What a fitted size is to the link": the pixel
// measures of a text style scaled to a new size, the font size the words fit at, and the
// override paths that a fitted or scaled measure gives. Pure, with no measuring, so the main
// process, the window and the quickstart give the same numbers.
import { textLookOf } from '@/shared/config/look'
import { LOOK_LIMITS, type TextStyle } from '@/shared/schemas/layer'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import type { Size } from '@/shared/scene/background-placement'
import { startingFontSize } from '@/shared/templates/starting-font-size'

// The four style fields that are pixels, in the order their paths are added.
const MEASURES = ['fontSize', 'boxPadding', 'boxRadius', 'boxOutlineWidth'] as const
type LookMeasure = 'boxPadding' | 'boxRadius' | 'boxOutlineWidth'

const clamp = (n: number, limit: { min: number; max: number }) =>
  Math.min(limit.max, Math.max(limit.min, n))

// Each pixel measure times k, rounded: fontSize at least 1, an outline at least 1 when there
// was one, each look field inside LOOK_LIMITS. An absent look field stays absent; k = 1
// changes nothing.
export function scaleTextMeasures(style: TextStyle, k: number): TextStyle {
  if (k === 1) return { ...style }
  const scaled: TextStyle = { ...style, fontSize: Math.max(1, Math.round(style.fontSize * k)) }
  const scale = (field: LookMeasure, least: number) => {
    const value = style[field]
    if (value === undefined) return
    scaled[field] = clamp(Math.max(least, Math.round(value * k)), LOOK_LIMITS[field])
  }
  scale('boxPadding', 0)
  scale('boxRadius', 0)
  scale('boxOutlineWidth', (style.boxOutlineWidth ?? 0) > 0 ? 1 : 0)
  return scaled
}

// The largest whole size, from the style's own size down to max(1, round(0.02 × S)), at which
// startingFontSize's estimate says the words fit the box; never larger than the style's size.
export function fittedFontSize(
  copy: string | null,
  box: { width: number; height: number },
  style: TextStyle,
  size: Size,
): number {
  const S = Math.min(size.width, size.height)
  const look = textLookOf(style)
  const fitted = startingFontSize(
    copy,
    box,
    {
      fontSizeOfSmaller: style.fontSize / S,
      lineHeight: look.lineHeight,
      letterSpacing: look.letterSpacing,
      allCaps: look.allCaps,
      padding: look.boxPadding,
      outline: look.boxOutlineWidth,
    },
    { S },
  )
  return Math.min(fitted, style.fontSize)
}

type MeasuredLayer = Pick<LayerRow, 'linked' | 'overrides' | 'style'>
type MasterStyle = Pick<LayerRow, 'style'>

// The layer's override paths, then, on a linked layer whose key the master has, each pixel
// measure whose value differs from the master layer's (absent counts as its default). Each
// path once.
export function measureOverrides(layer: MeasuredLayer, masterLayer: MasterStyle | null): string[] {
  const paths = [...layer.overrides]
  if (!layer.linked || !masterLayer) return paths
  const mine = textLookOf(layer.style as TextStyle)
  const master = textLookOf(masterLayer.style as TextStyle)
  for (const field of MEASURES) {
    const path = `style.${field}`
    if (mine[field] !== master[field] && !paths.includes(path)) paths.push(path)
  }
  return paths
}

type FittedLayer = Pick<LayerRow, 'type' | 'geometry'> & MeasuredLayer

// When a translation run first fills a text layer: the font size fitted to the new words,
// starting from the layer's current size and only ever smaller, with its override paths.
// Null when the size stays.
export function fitTranslatedText(
  layer: FittedLayer,
  copy: string | null,
  size: Size,
  masterLayer: MasterStyle | null,
): { style: TextStyle; overrides: string[] } | null {
  if (layer.type !== 'text') return null
  const current = layer.style as TextStyle
  const fontSize = fittedFontSize(copy, layer.geometry, current, size)
  if (fontSize >= current.fontSize) return null
  const style = { ...current, fontSize }
  return { style, overrides: measureOverrides({ ...layer, style }, masterLayer) }
}
