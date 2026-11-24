import type { Geometry, Revs } from '@/shared/schemas/layer'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import type { Size } from '@/shared/scene/background-placement'
import type { FanOutFit } from '@/shared/schemas/links'
import type { StarterLayout } from '@/shared/config/default-layout'
import { DEFAULT_STARTER_LAYOUT_ID } from '@/shared/config/starter-layouts'
import { anchoredBox } from './place-box'
import { layoutBoxOf, layoutOfLayers, sitsAsLaidOut } from './source-layout'

// spec/links-and-sync.md "Fan-out": the layer values of one new variant. Pure; no IDs are
// made here, the caller adds `id` and `variantId`.

export type VariantFacts = Size & { language: string }
export type PlannedLayer = Omit<LayerRow, 'id' | 'variantId'>

export type PlanInput = {
  master: VariantFacts
  masterLayers: LayerRow[]
  target: VariantFacts
  fit?: FanOutFit // only read when the pixel size differs; `fill` places as `scale`
  pictureSize: Size | null // the background picture's size, from its asset row
  sameSizePlan?: PlannedLayer[] | null // R-02: the plan of this size in the master's language
  layoutId?: string | null // breaks a tie in "Which layout"; absent or null: the default's ID
}

const ZERO_REVS: Revs = { copy: 0, style: 0, geometry: 0, source: 0, timing: 0, animation: 0 }

// Math.round gives -0 for small negatives; `+ 0` makes it a plain 0.
const whole = (n: number) => Math.round(n) + 0

function placeBackground(canvas: Size, picture: Size | null, fit: FanOutFit): Geometry {
  if (!picture) {
    return { x: 0, y: 0, width: canvas.width, height: canvas.height, rotation: 0, crop: null }
  }
  const pick = fit === 'crop' ? Math.max : Math.min
  const s = pick(canvas.width / picture.width, canvas.height / picture.height)
  const width = picture.width * s
  const height = picture.height * s
  return {
    x: whole((canvas.width - width) / 2),
    y: whole((canvas.height - height) / 2),
    width: whole(width),
    height: whole(height),
    rotation: 0,
    crop: null,
  }
}

// spec/make-variants.md "Where a box goes in a new size". The source is the master here.
function geometryFor(layer: LayerRow, input: PlanInput, layout: StarterLayout | null): Geometry {
  const { master, target } = input
  if (master.width === target.width && master.height === target.height) return layer.geometry
  const planned = input.sameSizePlan?.find((l) => l.key === layer.key)
  if (target.language !== master.language && planned) return planned.geometry
  if (layer.type === 'background') {
    const picture = layer.source ? input.pictureSize : null
    return placeBackground(target, picture, input.fit ?? 'scale')
  }
  const laidOut = layout !== null && sitsAsLaidOut(layout, layer, master)
  const box = laidOut ? layoutBoxOf(layout, layer, target) : null
  if (box) return { ...box, crop: layer.geometry.crop }
  return anchoredBox(layer.geometry, master, target, layer.type === 'text')
}

function planLayer(layer: LayerRow, input: PlanInput, layout: StarterLayout | null): PlannedLayer {
  const { key, type, slot, name, z, visible, locked, copy, style, source, timing, animation } =
    layer
  const newLanguage = input.target.language !== input.master.language
  const translated = newLanguage && layer.type === 'text'
  return structuredClone({
    key,
    type,
    slot,
    name,
    z,
    visible,
    locked,
    copy,
    style,
    source,
    timing,
    animation,
    geometry: geometryFor(layer, input, layout),
    linked: true,
    overrides: [],
    revs: ZERO_REVS,
    syncedRevs: layer.revs,
    translationStatus: translated ? 'missing' : layer.translationStatus,
    translationSource: translated ? null : layer.translationSource,
    overflow: false,
  })
}

export function planVariant(input: PlanInput): PlannedLayer[] {
  const preferredId = input.layoutId ?? DEFAULT_STARTER_LAYOUT_ID
  const layout = layoutOfLayers(input.masterLayers, input.master, preferredId)
  return input.masterLayers.map((layer) => planLayer(layer, input, layout))
}
