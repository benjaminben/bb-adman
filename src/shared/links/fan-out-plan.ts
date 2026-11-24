import type { Geometry, Revs } from '@/shared/schemas/layer'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import type { Size } from '@/shared/scene/background-placement'
import type { FanOutFit } from '@/shared/schemas/links'
import type { StarterLayout } from '@/shared/config/default-layout'
import { DEFAULT_STARTER_LAYOUT_ID } from '@/shared/config/starter-layouts'
import { groupOfPath } from './follow-rules'
import { anchoredBox } from './place-box'
import { layoutBoxOf, layoutOfLayers, sitsAsLaidOut } from './source-layout'

// spec/links-and-sync.md "Fan-out" and spec/make-variants.md "Links after making": the layer
// values of one new variant, made from the master or from another variant of the direction.
// Pure; no IDs are made here, the caller adds `id` and `variantId`.

export type VariantFacts = Size & { language: string }
export type PlannedLayer = Omit<LayerRow, 'id' | 'variantId'>
export type PlanSource = { facts: VariantFacts; layers: LayerRow[] }

export type PlanInput = {
  master: VariantFacts
  masterLayers: LayerRow[]
  target: VariantFacts
  fit?: FanOutFit // only read when the pixel size differs; `fill` places as `scale`
  pictureSize: Size | null // the source's background picture's size, from its asset row
  sameSizePlan?: PlannedLayer[] | null // R-02: the plan of this size in the source's language
  layoutId?: string | null // breaks a tie in "Which layout"; absent or null: the default's ID
  source?: PlanSource // the variant the new one is made from; absent: the master
  layoutLayers?: LayerRow[] // the layers "Which layout" looks at; absent: the source's layers
}

type Plan = {
  input: PlanInput
  from: VariantFacts // the source's facts
  fromMaster: boolean
  layout: StarterLayout | null
  masterByKey: Map<string, LayerRow>
}

const ZERO_REVS: Revs = { copy: 0, style: 0, geometry: 0, source: 0, timing: 0, animation: 0 }

// Math.round gives -0 for small negatives; `+ 0` makes it a plain 0.
const whole = (n: number) => Math.round(n) + 0
const samePixels = (a: Size, b: Size) => a.width === b.width && a.height === b.height

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

// spec/make-variants.md "Where a box goes in a new size", rules 2 to 5, from the source.
function placedGeometry(layer: LayerRow, plan: Plan): Geometry {
  const { input, from, layout } = plan
  const { target } = input
  if (samePixels(from, target)) return layer.geometry
  const planned = input.sameSizePlan?.find((l) => l.key === layer.key)
  if (target.language !== from.language && planned) return planned.geometry
  if (layer.type === 'background') {
    const picture = layer.source ? input.pictureSize : null
    return placeBackground(target, picture, input.fit ?? 'scale')
  }
  const laidOut = layout !== null && sitsAsLaidOut(layout, layer, from)
  const box = laidOut ? layoutBoxOf(layout, layer, target) : null
  if (box) return { ...box, crop: layer.geometry.crop }
  return anchoredBox(layer.geometry, from, target, layer.type === 'text')
}

// The parts every new layer takes from the source as they are.
function copiedParts(layer: LayerRow) {
  const { key, type, slot, name, z, visible, locked, style, source, timing, animation } = layer
  return { key, type, slot, name, z, visible, locked, style, source, timing, animation }
}

// "Links after making", geometry: the source's at the master's size when the source has it
// too, the master's at the master's size when it does not, else placed with no path.
function geometryPart(layer: LayerRow, master: LayerRow | undefined, counter: number, plan: Plan) {
  const { input, from } = plan
  const atMasterSize = samePixels(input.target, input.master)
  if (atMasterSize && samePixels(from, input.master)) {
    return { geometry: layer.geometry, counter, keepPath: true }
  }
  if (atMasterSize && master) {
    return { geometry: master.geometry, counter: master.revs.geometry, keepPath: false }
  }
  return { geometry: placedGeometry(layer, plan), counter, keepPath: false }
}

// "Links after making", copy: the source's in its language, else the master's words.
function copyPart(layer: LayerRow, master: LayerRow | undefined, counter: number, plan: Plan) {
  const { target } = plan.input
  if (target.language === plan.from.language) {
    const { copy, translationStatus, translationSource } = layer
    return { copy, translationStatus, translationSource, counter, keepPath: true }
  }
  const text = layer.type === 'text'
  const missing = text && target.language !== plan.input.master.language
  return {
    copy: (master ?? layer).copy,
    translationStatus: text ? (missing ? ('missing' as const) : null) : layer.translationStatus,
    translationSource: text ? null : layer.translationSource,
    counter: master ? master.revs.copy : counter,
    keepPath: false,
  }
}

function linkedLayer(layer: LayerRow, plan: Plan): PlannedLayer {
  const master = plan.fromMaster ? layer : plan.masterByKey.get(layer.key)
  const counters = plan.fromMaster ? layer.revs : layer.syncedRevs
  const geometry = geometryPart(layer, master, counters.geometry, plan)
  const copy = copyPart(layer, master, counters.copy, plan)
  const dropped = new Set([
    ...(geometry.keepPath ? [] : ['geometry']),
    ...(copy.keepPath ? [] : ['copy']),
  ])
  const overrides = plan.fromMaster
    ? []
    : layer.overrides.filter((p) => !dropped.has(groupOfPath(p) ?? ''))
  return structuredClone({
    ...copiedParts(layer),
    copy: copy.copy,
    geometry: geometry.geometry,
    linked: true,
    overrides,
    revs: ZERO_REVS,
    syncedRevs: { ...counters, geometry: geometry.counter, copy: copy.counter },
    translationStatus: copy.translationStatus,
    translationSource: copy.translationSource,
    overflow: false,
  })
}

// "Links after making": a layer made on the source is copied with its own values and no
// link; in another language its words stay, marked missing.
function unlinkedLayer(layer: LayerRow, plan: Plan): PlannedLayer {
  const otherLanguage = plan.input.target.language !== plan.from.language
  const missing = otherLanguage && layer.type === 'text'
  return structuredClone({
    ...copiedParts(layer),
    copy: layer.copy,
    geometry: placedGeometry(layer, plan),
    linked: false,
    overrides: [],
    revs: ZERO_REVS,
    syncedRevs: layer.syncedRevs,
    translationStatus: missing ? 'missing' : layer.translationStatus,
    translationSource: missing ? null : layer.translationSource,
    overflow: false,
  })
}

export function planVariant(input: PlanInput): PlannedLayer[] {
  const from = input.source?.facts ?? input.master
  const layers = input.source?.layers ?? input.masterLayers
  const preferredId = input.layoutId ?? DEFAULT_STARTER_LAYOUT_ID
  const plan: Plan = {
    input,
    from,
    fromMaster: input.source === undefined,
    layout: layoutOfLayers(input.layoutLayers ?? layers, from, preferredId),
    masterByKey: new Map(input.masterLayers.map((l) => [l.key, l])),
  }
  return layers.map((layer) =>
    plan.fromMaster || layer.linked ? linkedLayer(layer, plan) : unlinkedLayer(layer, plan),
  )
}
