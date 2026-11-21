// SPEC 6.1 "Default layout" [1.23] and SPEC 14 [1.9]: the layers of a new master variant.
// The background layer always, then one layer per other filled slot in the template's
// order, z counting up from 0 with no gaps. Every box, style, name and fixed value comes
// from config/default-layout.ts. Pure; throws a plain Error only for a programming error.
import type { CampaignSize } from '../schemas/commands/campaign'
import type { Geometry, TextStyle } from '../schemas/layer'
import type { BuildMasterLayers, NewLayer, Slot, SlotFill, SlotFills, Template } from './types'
import {
  BACKGROUND_LAYOUT,
  BACKGROUND_SLOT_ID,
  GEOMETRY_ROTATION,
  IMAGE_STYLE,
  LAYER_DEFAULTS,
  MARGIN_OF_SMALLER,
  OTHER_COPY_BOX,
  OTHER_COPY_TEXT,
  OTHER_IMAGE_BOX,
  SIDE_OF_SMALLER,
  SLOT_LAYOUTS,
  type BoxRule,
  type Extent,
  type Place,
  type TextStyleRule,
} from '../config/default-layout'

type Frame = { W: number; H: number; S: number; m: number; side: number }

function frameOf(size: CampaignSize): Frame {
  const S = Math.min(size.width, size.height)
  return {
    W: size.width,
    H: size.height,
    S,
    m: Math.round(MARGIN_OF_SMALLER * S),
    side: Math.round(SIDE_OF_SMALLER * S),
  }
}

function extent(rule: Extent, f: Frame, whole: number): number {
  if (rule === 'full') return whole
  if (rule === 'inset') return whole - 2 * f.m
  if (rule === 'side') return f.side
  if ('ofSmaller' in rule) return Math.round(rule.ofSmaller * f.S)
  return Math.round(rule.ofHeight * f.H)
}

function place(rule: Place, f: Frame, whole: number, length: number): number {
  if (rule === 'zero') return 0
  if (rule === 'margin') return f.m
  if (rule === 'centre') return Math.round((whole - length) / 2)
  return Math.round(rule.ofHeight * f.H)
}

function geometryOf(box: BoxRule, f: Frame): Geometry {
  const width = extent(box.width, f, f.W)
  const height = extent(box.height, f, f.H)
  const x = place(box.x, f, f.W, width)
  const y = place(box.y, f, f.H, height)
  return { x, y, width, height, rotation: GEOMETRY_ROTATION, crop: null }
}

function textStyleOf(rule: TextStyleRule, f: Frame): TextStyle {
  const { fontSizeOfSmaller, ...rest } = rule
  return { ...rest, fontSize: Math.round(fontSizeOfSmaller * f.S) }
}

// A fresh copy each time, so a caller that changes a layer changes nothing shared.
function fixedValues(): typeof LAYER_DEFAULTS {
  return structuredClone(LAYER_DEFAULTS)
}

function checkFills(template: Template, fills: SlotFills): void {
  const slots = new Map(template.slots.map((s) => [s.id, s]))
  // SPEC 6.1 [1.25]: a background slot that is not an image slot is a programming error.
  if (slots.get(BACKGROUND_SLOT_ID)?.type === 'copy') {
    throw new Error('buildMasterLayers: the background slot must be an image slot')
  }
  for (const [id, fill] of Object.entries(fills)) {
    const slot = slots.get(id)
    if (!slot) throw new Error(`buildMasterLayers: the template has no slot "${id}"`)
    if (fill && 'text' in fill !== (slot.type === 'copy')) {
      throw new Error(`buildMasterLayers: the fill for slot "${id}" is of the wrong sort`)
    }
  }
}

function backgroundLayer(template: Template, fills: SlotFills, f: Frame): NewLayer {
  const hasSlot = template.slots.some((s) => s.id === BACKGROUND_SLOT_ID)
  const fill = fills[BACKGROUND_SLOT_ID]
  return {
    ...fixedValues(),
    key: BACKGROUND_SLOT_ID,
    type: 'background',
    slot: hasSlot ? BACKGROUND_SLOT_ID : null,
    name: BACKGROUND_LAYOUT.name,
    z: 0,
    copy: null,
    style: { ...IMAGE_STYLE },
    geometry: geometryOf(BACKGROUND_LAYOUT.box, f),
    source: fill && 'assetId' in fill ? { assetId: fill.assetId } : null,
  }
}

function slotLayer(slot: Slot, fill: SlotFill, z: number, f: Frame): NewLayer {
  const named = SLOT_LAYOUTS[slot.id]
  const isCopy = slot.type === 'copy'
  const box = named?.box ?? (isCopy ? OTHER_COPY_BOX : OTHER_IMAGE_BOX)
  return {
    ...fixedValues(),
    key: slot.id,
    type: isCopy ? 'text' : 'image',
    slot: slot.id,
    name: named?.name ?? slot.id,
    z,
    copy: 'text' in fill ? fill.text : null,
    style: isCopy ? textStyleOf(named?.text ?? OTHER_COPY_TEXT, f) : { ...IMAGE_STYLE },
    geometry: geometryOf(box, f),
    source: 'assetId' in fill ? { assetId: fill.assetId } : null,
  }
}

export const buildMasterLayers: BuildMasterLayers = (template, size, fills) => {
  checkFills(template, fills)
  const f = frameOf(size)
  const layers = [backgroundLayer(template, fills, f)]
  for (const slot of template.slots) {
    const fill = fills[slot.id]
    if (slot.id === BACKGROUND_SLOT_ID || !fill) continue
    layers.push(slotLayer(slot, fill, layers.length, f))
  }
  return layers
}
