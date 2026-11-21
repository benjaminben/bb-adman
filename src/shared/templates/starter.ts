// SPEC 6.1 starter template [FR-040, FR-041] and the slot view's states [FR-042]. Pure.
// A template lists slots only; it defines no positions (FR-040).
import type { LayerRow } from '@/shared/schemas/rows/layer'
import type { SlotStates, Template } from './types'

export const starterTemplate: Template = {
  id: 'starter',
  name: 'Starter',
  slots: [
    { id: 'background', type: 'image' },
    { id: 'subject-image', type: 'image' },
    { id: 'logo', type: 'image' },
    { id: 'headline', type: 'copy' },
    { id: 'call-to-action', type: 'copy' },
  ],
}

// SPEC 3.3 [1.23]: a text layer fills its slot; an image or background layer fills it only
// once it has a source, because the background layer exists before any picture is chosen.
function fills(layer: LayerRow): boolean {
  return layer.type === 'text' || layer.source !== null
}

// SPEC 14 [1.9]: one entry per slot, in the template's order. A slot is filled when a layer
// fills it. A copy slot has no candidates; asset IDs are passed through as given.
export const slotStates: SlotStates = (template, layers, candidates) => {
  const filled = new Set(layers.filter(fills).map((l) => l.slot))
  return template.slots.map((slot) => ({
    slot,
    state: filled.has(slot.id) ? 'filled' : 'empty',
    candidates: slot.type === 'image' ? [...(candidates[slot.id] ?? [])] : [],
  }))
}
