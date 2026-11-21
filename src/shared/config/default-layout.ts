// SPEC 6.1 "Default layout" [1.23], FR-040, FR-043, spec/starter-layouts.md: the one owner of
// every number and name a new master variant's layers start with, and of the default starter
// layout. A template holds no position; this file does. buildMasterLayers holds no number.
import type { Animation, ImageStyle, Revs, Shade, Timing } from '@/shared/schemas/layer'
import { NEW_SHADE } from './look'

// W and H are the size's sides, S the smaller one. Every result is rounded to a whole pixel.
export const MARGIN_OF_SMALLER = 0.06 // m
export const SIDE_OF_SMALLER = 0.46 // side, for centred image boxes

// The starting font size's estimate (spec/starter-layouts.md "The starting font size"): a
// letter's width as a share of the font size, how full a line is filled, the smallest size.
export const FONT_ESTIMATE = {
  letter: 0.6,
  capital: 0.7,
  wide: 1, // a letter of the Han, Hiragana, Katakana or Hangul scripts
  lineFill: 0.9,
  smallestOfSmaller: 0.02,
} as const

// Where a box starts on one axis: 0, the margin, centred, one margin before the far edge, or a
// share of H (used for y only).
export type Place = 'zero' | 'margin' | 'centre' | 'end' | { ofHeight: number }
// How long a box is on one axis: the whole side, the side less two margins, `side`, or a
// share of S or of H.
export type Extent = 'full' | 'inset' | 'side' | { ofSmaller: number } | { ofHeight: number }
export type BoxRule = { x: Place; y: Place; width: Extent; height: Extent }

// fontSizeOfSmaller is the largest starting size; the size comes from the copy's length.
export type TextStyleRule = {
  fontAssetId: null
  fontSizeOfSmaller: number
  fontWeight: number
  color: string
  align: 'left' | 'center' | 'right'
  lineHeight: number
  letterSpacing: number
}

// A text slot's look fields; the box numbers are shares of S.
export type TextBoxRule = {
  verticalAlign: 'top' | 'middle' | 'bottom'
  allCaps: boolean
  boxColor: string | null
  boxOutlineColor: string | null
  boxOutlineOfSmaller: number // 0 = no outline
  boxRadiusOfSmaller: number
  boxPaddingOfSmaller: number
}

export type LayoutSlot = {
  box: BoxRule
  text?: TextStyleRule
  textBox?: TextBoxRule
  shade?: Shade | null
}
export type SlotLayout = LayoutSlot & { name: string }
export type BackgroundLook = { fillColor: string | null; shade: Shade | null }
export type StarterLayout = {
  id: string // kebab-case, unique
  name: string
  description: string
  background: BackgroundLook
  slots: Readonly<Record<string, LayoutSlot>>
}

export const BACKGROUND_SLOT_ID = 'background'

export const BACKGROUND_LAYOUT: SlotLayout = {
  name: 'Background',
  box: { x: 'zero', y: 'zero', width: 'full', height: 'full' },
}

const WHITE = '#FFFFFF'

// The names of the template's slots; read by the code through SLOT_LAYOUTS only.
const SLOT_NAMES: Readonly<Record<string, string>> = {
  'subject-image': 'Subject image',
  logo: 'Logo',
  headline: 'Headline',
  'call-to-action': 'Call to action',
}

// The default starter layout's slots, photo-bottom-left (spec/starter-layouts.md, layout 1).
const DEFAULT_SLOTS: Readonly<Record<string, LayoutSlot>> = {
  'subject-image': {
    box: { x: 'centre', y: { ofHeight: 0.14 }, width: 'side', height: 'side' },
  },
  logo: {
    box: { x: 'margin', y: 'margin', width: { ofSmaller: 0.14 }, height: { ofSmaller: 0.14 } },
  },
  headline: {
    box: { x: 'margin', y: { ofHeight: 0.62 }, width: 'inset', height: { ofHeight: 0.22 } },
    text: {
      fontAssetId: null,
      fontSizeOfSmaller: 0.075,
      fontWeight: 700,
      color: WHITE,
      align: 'left',
      lineHeight: 1.1,
      letterSpacing: 0,
    },
    textBox: {
      verticalAlign: 'bottom',
      allCaps: false,
      boxColor: null,
      boxOutlineColor: null,
      boxOutlineOfSmaller: 0,
      boxRadiusOfSmaller: 0,
      boxPaddingOfSmaller: 0,
    },
  },
  'call-to-action': {
    box: { x: 'margin', y: 'end', width: { ofSmaller: 0.42 }, height: { ofSmaller: 0.09 } },
    text: {
      fontAssetId: null,
      fontSizeOfSmaller: 0.035,
      fontWeight: 600,
      color: WHITE,
      align: 'center',
      lineHeight: 1.2,
      letterSpacing: 0.02,
    },
    textBox: {
      verticalAlign: 'middle',
      allCaps: false,
      boxColor: null,
      boxOutlineColor: WHITE,
      boxOutlineOfSmaller: 0.003,
      boxRadiusOfSmaller: 0,
      boxPaddingOfSmaller: 0.015,
    },
  },
}

// No colour, and the shade a new shade starts with (NEW_SHADE holds the default's values).
export const BACKGROUND_LOOK: BackgroundLook = { fillColor: null, shade: NEW_SHADE }

export const DEFAULT_STARTER_LAYOUT: StarterLayout = {
  id: 'photo-bottom-left',
  name: 'Photo, text at the bottom left',
  description:
    'Text at the bottom left over a photo, with a dark shade from the bottom and an outlined button.',
  background: BACKGROUND_LOOK,
  slots: DEFAULT_SLOTS,
}

// The default layout with the slot names, read by Phase 4 code by this name.
export const SLOT_LAYOUTS: Readonly<Record<string, SlotLayout>> = Object.fromEntries(
  Object.entries(DEFAULT_SLOTS).map(([id, slot]) => [id, { name: SLOT_NAMES[id] ?? id, ...slot }]),
)

// A slot no layout names, and a layer the user adds; its name is its slot ID. These rows keep
// the look new layers had before the starter layouts, with no box.
export const OTHER_IMAGE_BOX: BoxRule = { x: 'centre', y: 'centre', width: 'side', height: 'side' }
export const OTHER_COPY_BOX: BoxRule = {
  x: 'margin',
  y: { ofHeight: 0.42 },
  width: 'inset',
  height: { ofHeight: 0.16 },
}
export const OTHER_COPY_TEXT: TextStyleRule = {
  fontAssetId: null,
  fontSizeOfSmaller: 0.07,
  fontWeight: 700,
  color: WHITE,
  align: 'center',
  lineHeight: 1.1,
  letterSpacing: 0,
}

export const IMAGE_STYLE: ImageStyle = { opacity: 1 }
export const GEOMETRY_ROTATION = 0

// The same values on every layer of a new master. [1.26] revs, syncedRevs, the entrance and
// the exit are each written out, so no two of them are one object.
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
  animation: {
    entrance: { preset: 'none', startMs: 0, durationMs: 0 },
    exit: { preset: 'none', startMs: 0, durationMs: 0 },
  },
  revs: { copy: 0, style: 0, geometry: 0, source: 0, timing: 0, animation: 0 },
  syncedRevs: { copy: 0, style: 0, geometry: 0, source: 0, timing: 0, animation: 0 },
  translationStatus: null,
  translationSource: null,
  overflow: false,
}
