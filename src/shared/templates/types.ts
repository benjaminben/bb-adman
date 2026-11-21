// SPEC 6.1 templates and the signatures of slice B's functions (SPEC 14, "Contract between
// the slices"). Frozen contract (Phase 2 step 0). Types only; slice B writes the bodies.
import type { Result } from '../schemas/result'
import type { BriefDraft } from '../schemas/brief'
import type { CampaignSize } from '../schemas/commands/campaign'
import type { LayerRow } from '../schemas/rows/layer'

export type SlotType = 'image' | 'copy'

export type Slot = { id: string; type: SlotType }

export type Template = { id: string; name: string; slots: Slot[] }

// A layer's values without `id` and `variantId`.
export type NewLayer = Omit<LayerRow, 'id' | 'variantId'>

// What fills a slot: an asset for an image slot, text for a copy slot.
export type SlotFill = { assetId: string } | { text: string }
export type SlotFills = Partial<Record<string, SlotFill>>

export type SlotState = {
  slot: Slot
  state: 'filled' | 'empty'
  candidates: string[] // asset IDs that could fill the slot
}

export type BriefSyntax = 'json' | 'yaml'
export type WordList = string[] | Record<string, string[]>

// The error is INVALID_INPUT with details.reason 'brief_unreadable' or, for text over the
// limit, 'brief_too_large' (SPEC 4.1, 6.1).
export type ParseBrief = (text: string, syntax: BriefSyntax) => Result<BriefDraft>
export type PrimaryLanguageFor = (region: string) => string | null
export type IsRightToLeft = (tag: string) => boolean
export type WordsByLanguageFn = (
  words: WordList,
  primaryLanguage: string,
) => Record<string, string[]>
export type ParseSize = (text: string) => CampaignSize | null
export type BuildMasterLayers = (
  template: Template,
  size: CampaignSize,
  fills: SlotFills,
) => NewLayer[]
export type SlotStates = (
  template: Template,
  layers: LayerRow[],
  candidates: Record<string, string[]>,
) => SlotState[]
