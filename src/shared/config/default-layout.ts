// SPEC 6.1 "Default layout" [1.23], FR-040, FR-043: the one owner of every number and name
// a new master variant's layers start with. A template holds no position; this file does.
// Provisional until the UI pass (OI-33). buildMasterLayers reads it and holds no number.
import type { Animation, ImageStyle, Revs, Timing } from '../schemas/layer'

// W and H are the size's sides, S the smaller one. Every result is rounded to a whole pixel.
export const MARGIN_OF_SMALLER = 0.06 // m
export const SIDE_OF_SMALLER = 0.46 // side, for centred image boxes

// Where a box starts on one axis: 0, the margin, centred, or a share of H.
export type Place = 'zero' | 'margin' | 'centre' | { ofHeight: number }
// How long a box is on one axis: the whole side, the side less two margins, `side`, or a
// share of S or of H.
export type Extent = 'full' | 'inset' | 'side' | { ofSmaller: number } | { ofHeight: number }
export type BoxRule = { x: Place; y: Place; width: Extent; height: Extent }

export type TextStyleRule = {
  fontAssetId: null
  fontSizeOfSmaller: number
  fontWeight: number
  color: string
  align: 'left' | 'center' | 'right'
  lineHeight: number
  letterSpacing: number
}

export type SlotLayout = { name: string; box: BoxRule; text?: TextStyleRule }

const HEADLINE_TEXT: TextStyleRule = {
  fontAssetId: null,
  fontSizeOfSmaller: 0.07,
  fontWeight: 700,
  color: '#FFFFFF',
  align: 'center',
  lineHeight: 1.1,
  letterSpacing: 0,
}

export const BACKGROUND_SLOT_ID = 'background'

export const BACKGROUND_LAYOUT: SlotLayout = {
  name: 'Background',
  box: { x: 'zero', y: 'zero', width: 'full', height: 'full' },
}

export const SLOT_LAYOUTS: Readonly<Record<string, SlotLayout>> = {
  'subject-image': {
    name: 'Subject image',
    box: { x: 'centre', y: { ofHeight: 0.22 }, width: 'side', height: 'side' },
  },
  logo: {
    name: 'Logo',
    box: { x: 'margin', y: 'margin', width: { ofSmaller: 0.14 }, height: { ofSmaller: 0.14 } },
  },
  headline: {
    name: 'Headline',
    box: { x: 'margin', y: { ofHeight: 0.7 }, width: 'inset', height: { ofHeight: 0.16 } },
    text: HEADLINE_TEXT,
  },
  'call-to-action': {
    name: 'Call to action',
    box: { x: 'margin', y: { ofHeight: 0.88 }, width: 'inset', height: { ofHeight: 0.06 } },
    text: { ...HEADLINE_TEXT, fontSizeOfSmaller: 0.035, fontWeight: 600, lineHeight: 1.2 },
  },
}

// A slot the table above does not name. Its name is its slot ID.
export const OTHER_IMAGE_BOX: BoxRule = { x: 'centre', y: 'centre', width: 'side', height: 'side' }
export const OTHER_COPY_BOX: BoxRule = {
  x: 'margin',
  y: { ofHeight: 0.42 },
  width: 'inset',
  height: { ofHeight: 0.16 },
}
export const OTHER_COPY_TEXT: TextStyleRule = HEADLINE_TEXT

export const IMAGE_STYLE: ImageStyle = { opacity: 1 }
export const GEOMETRY_ROTATION = 0

const ZERO_REVS: Revs = { copy: 0, style: 0, geometry: 0, source: 0, timing: 0, animation: 0 }
const STILL = { preset: 'none', startMs: 0, durationMs: 0 } as const

// The same values on every layer of a new master.
export const LAYER_DEFAULTS: {
  visible: boolean
  locked: boolean
  linked: boolean
  overrides: string[]
  timing: Timing
  animation: Animation
  revs: Revs
  syncedRevs: Revs
  translationStatus: null
  translationSource: null
  overflow: boolean
} = {
  visible: true,
  locked: false,
  linked: false,
  overrides: [],
  timing: { startMs: 0, endMs: null },
  animation: { entrance: STILL, exit: STILL },
  revs: ZERO_REVS,
  syncedRevs: ZERO_REVS,
  translationStatus: null,
  translationSource: null,
  overflow: false,
}
