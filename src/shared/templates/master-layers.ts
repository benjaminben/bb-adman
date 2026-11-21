// SPEC 6.1 "Default layout" [1.23], SPEC 14 [1.9], spec/starter-layouts.md: the layers of a
// new master variant, built from the default starter layout. The background layer always,
// then one layer per other filled slot in the template's order, z counting up from 0 with no
// gaps. Every box, style, name and fixed value comes from config/default-layout.ts through
// layout-rules.ts. New layers store every look field. Pure; throws a plain Error only for a
// programming error.
import type { BuildMasterLayers, NewLayer, Slot, SlotFill, SlotFills, Template } from './types'
import type { ImageStyle, Shade } from '@/shared/schemas/layer'
import { frameOf, geometryOf, textStyleOf, type Frame } from './layout-rules'
import {
  BACKGROUND_LAYOUT,
  BACKGROUND_LOOK,
  BACKGROUND_SLOT_ID,
  IMAGE_STYLE,
  LAYER_DEFAULTS,
  OTHER_COPY_BOX,
  OTHER_COPY_TEXT,
  OTHER_IMAGE_BOX,
  SLOT_LAYOUTS,
} from '@/shared/config/default-layout'

// A fresh copy each time, so a caller that changes a layer changes nothing shared.
function fixedValues(): typeof LAYER_DEFAULTS {
  return structuredClone(LAYER_DEFAULTS)
}

const shadeCopy = (shade: Shade | null | undefined): Shade | null => (shade ? { ...shade } : null)

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
  const style: ImageStyle = {
    ...IMAGE_STYLE,
    fillColor: BACKGROUND_LOOK.fillColor,
    shade: shadeCopy(BACKGROUND_LOOK.shade),
  }
  return {
    ...fixedValues(),
    key: BACKGROUND_SLOT_ID,
    type: 'background',
    slot: hasSlot ? BACKGROUND_SLOT_ID : null,
    name: BACKGROUND_LAYOUT.name,
    z: 0,
    copy: null,
    style,
    geometry: geometryOf(BACKGROUND_LAYOUT.box, f),
    source: fill && 'assetId' in fill ? { assetId: fill.assetId } : null,
  }
}

function slotLayer(slot: Slot, fill: SlotFill, z: number, f: Frame): NewLayer {
  const named = SLOT_LAYOUTS[slot.id]
  const isCopy = slot.type === 'copy'
  const geometry = geometryOf(named?.box ?? (isCopy ? OTHER_COPY_BOX : OTHER_IMAGE_BOX), f)
  const copy = 'text' in fill ? fill.text : null
  const textRule = named?.text ? { ...named, text: named.text } : { text: OTHER_COPY_TEXT }
  return {
    ...fixedValues(),
    key: slot.id,
    type: isCopy ? 'text' : 'image',
    slot: slot.id,
    name: named?.name ?? slot.id,
    z,
    copy,
    style: isCopy
      ? textStyleOf(textRule, copy, geometry, f)
      : { ...IMAGE_STYLE, shade: shadeCopy(named?.shade) },
    geometry,
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
