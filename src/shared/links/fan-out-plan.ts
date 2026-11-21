import type { Geometry, Revs } from '@/shared/schemas/layer'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import type { Size } from '@/shared/scene/background-placement'
import type { FanOutFit } from '@/shared/schemas/links'

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

// Same centre share of the canvas; width and height scaled by the smaller ratio.
function placeBox(geometry: Geometry, from: Size, to: Size): Geometry {
  const k = Math.min(to.width / from.width, to.height / from.height)
  const width = Math.max(1, whole(geometry.width * k))
  const height = Math.max(1, whole(geometry.height * k))
  const centreX = ((geometry.x + geometry.width / 2) / from.width) * to.width
  const centreY = ((geometry.y + geometry.height / 2) / from.height) * to.height
  return {
    ...geometry,
    x: whole(centreX - width / 2),
    y: whole(centreY - height / 2),
    width,
    height,
  }
}

function geometryFor(layer: LayerRow, input: PlanInput): Geometry {
  const { master, target } = input
  if (master.width === target.width && master.height === target.height) return layer.geometry
  const planned = input.sameSizePlan?.find((l) => l.key === layer.key)
  if (target.language !== master.language && planned) return planned.geometry
  if (layer.type !== 'background') return placeBox(layer.geometry, master, target)
  const picture = layer.source ? input.pictureSize : null
  return placeBackground(target, picture, input.fit ?? 'scale')
}

function planLayer(layer: LayerRow, input: PlanInput): PlannedLayer {
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
    geometry: geometryFor(layer, input),
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
  return input.masterLayers.map((layer) => planLayer(layer, input))
}
