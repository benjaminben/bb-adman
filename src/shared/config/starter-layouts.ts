// spec/starter-layouts.md "The five layouts" [D-094]: the starter layouts, as data. The default
// layout is imported from default-layout.ts (its one owner); the other four are written here,
// row for row as the spec's tables. Read by "Layout…" (LK-6) through starterLayoutPatches.
import {
  DEFAULT_STARTER_LAYOUT,
  type StarterLayout,
  type TextBoxRule,
  type TextStyleRule,
} from './default-layout'

export const DEFAULT_STARTER_LAYOUT_ID = DEFAULT_STARTER_LAYOUT.id

// One row of the spec's text table: largest size (share of S), weight, colour, align, line
// height, letter spacing.
function text(
  fontSizeOfSmaller: number,
  fontWeight: number,
  color: string,
  align: TextStyleRule['align'],
  lineHeight: number,
  letterSpacing: number,
): TextStyleRule {
  return {
    fontAssetId: null,
    fontSizeOfSmaller,
    fontWeight,
    color,
    align,
    lineHeight,
    letterSpacing,
  }
}

// The rest of the row: vertical align, all capitals, and the box (none unless given).
function look(
  verticalAlign: TextBoxRule['verticalAlign'],
  allCaps: boolean,
  box: Partial<TextBoxRule> = {},
): TextBoxRule {
  return {
    verticalAlign,
    allCaps,
    boxColor: null,
    boxOutlineColor: null,
    boxOutlineOfSmaller: 0,
    boxRadiusOfSmaller: 0,
    boxPaddingOfSmaller: 0,
    ...box,
  }
}

const WHITE = '#FFFFFF'
const INK = '#111111'
const LOGO = { width: { ofSmaller: 0.14 }, height: { ofSmaller: 0.14 } } as const
const OUTLINED = { boxOutlineColor: WHITE, boxOutlineOfSmaller: 0.003, boxPaddingOfSmaller: 0.015 }

const PHOTO_TOP_CENTRE: StarterLayout = {
  id: 'photo-top-centre',
  name: 'Photo, headline at the top',
  description:
    'A centred headline in capitals at the top, the subject in the middle and an outlined button at the bottom.',
  background: {
    fillColor: null,
    shade: { color: '#000000', from: 'top', strength: 0.45, reach: 0.5 },
  },
  slots: {
    headline: {
      box: { x: 'margin', y: { ofHeight: 0.08 }, width: 'inset', height: { ofHeight: 0.24 } },
      text: text(0.08, 500, WHITE, 'center', 1.1, 0.04),
      textBox: look('top', true),
    },
    'subject-image': {
      box: { x: 'centre', y: { ofHeight: 0.36 }, width: 'side', height: 'side' },
    },
    logo: { box: { x: 'margin', y: 'end', ...LOGO } },
    'call-to-action': {
      box: { x: 'centre', y: 'end', width: { ofSmaller: 0.32 }, height: { ofSmaller: 0.09 } },
      text: text(0.032, 700, WHITE, 'center', 1.2, 0.08),
      textBox: look('middle', true, OUTLINED),
    },
  },
}

const FLAT_BOTTOM_LEFT: StarterLayout = {
  id: 'flat-bottom-left',
  name: 'Flat colour, big headline',
  description:
    'A flat warm colour, the subject at the top right and a large dark headline at the bottom left.',
  background: { fillColor: '#FFD54A', shade: null },
  slots: {
    'subject-image': {
      box: { x: 'end', y: 'margin', width: { ofSmaller: 0.6 }, height: { ofSmaller: 0.6 } },
    },
    logo: { box: { x: 'margin', y: 'margin', ...LOGO } },
    headline: {
      box: { x: 'margin', y: { ofHeight: 0.7 }, width: 'inset', height: { ofHeight: 0.16 } },
      text: text(0.09, 800, '#2B2B2B', 'left', 1.05, -0.01),
      textBox: look('bottom', false),
    },
    'call-to-action': {
      box: { x: 'margin', y: 'end', width: 'inset', height: { ofSmaller: 0.07 } },
      text: text(0.04, 600, '#D9480F', 'left', 1.2, 0),
      textBox: look('top', false),
    },
  },
}

const FLAT_CENTRE_TOP: StarterLayout = {
  id: 'flat-centre-top',
  name: 'Flat colour, headline above the subject',
  description:
    'A light flat colour, the logo and a centred headline at the top, and the subject below, running off the bottom edge.',
  background: { fillColor: '#F2F2F5', shade: null },
  slots: {
    logo: { box: { x: 'centre', y: 'margin', ...LOGO } },
    headline: {
      box: { x: 'margin', y: { ofHeight: 0.22 }, width: 'inset', height: { ofHeight: 0.18 } },
      text: text(0.075, 700, INK, 'center', 1.1, -0.01),
      textBox: look('top', false),
    },
    'call-to-action': {
      box: { x: 'margin', y: { ofHeight: 0.41 }, width: 'inset', height: { ofHeight: 0.05 } },
      text: text(0.035, 500, INK, 'center', 1.2, 0),
      textBox: look('top', false),
    },
    'subject-image': {
      box: {
        x: 'centre',
        y: { ofHeight: 0.48 },
        width: { ofSmaller: 0.7 },
        height: { ofSmaller: 0.7 },
      },
    },
  },
}

const PHOTO_LABEL_BOX: StarterLayout = {
  id: 'photo-label-box',
  name: 'Photo, text on a label',
  description:
    'The headline on a white label at the bottom left and a dark filled button, with no shade.',
  background: { fillColor: null, shade: null },
  slots: {
    'subject-image': {
      box: { x: 'centre', y: { ofHeight: 0.12 }, width: 'side', height: 'side' },
    },
    logo: { box: { x: 'margin', y: 'margin', ...LOGO } },
    headline: {
      box: { x: 'margin', y: { ofHeight: 0.6 }, width: 'inset', height: { ofHeight: 0.24 } },
      text: text(0.07, 700, INK, 'left', 1.1, 0),
      textBox: look('middle', false, {
        boxColor: WHITE,
        boxRadiusOfSmaller: 0.012,
        boxPaddingOfSmaller: 0.03,
      }),
    },
    'call-to-action': {
      box: { x: 'margin', y: 'end', width: { ofSmaller: 0.42 }, height: { ofSmaller: 0.09 } },
      text: text(0.035, 600, WHITE, 'center', 1.2, 0.02),
      textBox: look('middle', false, {
        boxColor: INK,
        boxRadiusOfSmaller: 0.045,
        boxPaddingOfSmaller: 0.015,
      }),
    },
  },
}

export const STARTER_LAYOUTS: readonly StarterLayout[] = [
  DEFAULT_STARTER_LAYOUT,
  PHOTO_TOP_CENTRE,
  FLAT_BOTTOM_LEFT,
  FLAT_CENTRE_TOP,
  PHOTO_LABEL_BOX,
]

// spec/brief-brand.md "Shared helpers": the layout with exactly this ID, or null. A list
// search, so a name such as "constructor" finds nothing.
export function starterLayoutOf(id: string): StarterLayout | null {
  return STARTER_LAYOUTS.find((l) => l.id === id) ?? null
}
