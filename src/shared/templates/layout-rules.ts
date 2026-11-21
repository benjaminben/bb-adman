// spec/brief-and-templates.md "Boxes" and spec/starter-layouts.md "Rules shared by every
// layout": a layout's boxes and text styles for one size. Shared by buildMasterLayers and
// starterLayoutPatches, so both give the same numbers. Pure.
import type { Geometry, TextStyle } from '@/shared/schemas/layer'
import { TEXT_LOOK_DEFAULTS, type TextLook } from '@/shared/config/look'
import {
  GEOMETRY_ROTATION,
  MARGIN_OF_SMALLER,
  SIDE_OF_SMALLER,
  type BoxRule,
  type Extent,
  type Place,
  type TextBoxRule,
  type TextStyleRule,
} from '@/shared/config/default-layout'
import { startingFontSize } from './starting-font-size'

export type Frame = { W: number; H: number; S: number; m: number; side: number }
type Look = Pick<TextLook, keyof typeof TEXT_LOOK_DEFAULTS>

export function frameOf(size: { width: number; height: number }): Frame {
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

// { ofHeight } is a share of H on either axis; the layouts use it for y only.
function place(rule: Place, f: Frame, whole: number, length: number): number {
  if (rule === 'zero') return 0
  if (rule === 'margin') return f.m
  if (rule === 'centre') return Math.round((whole - length) / 2)
  if (rule === 'end') return whole - f.m - length
  return Math.round(rule.ofHeight * f.H)
}

export function geometryOf(box: BoxRule, f: Frame): Geometry {
  const width = extent(box.width, f, f.W)
  const height = extent(box.height, f, f.H)
  const x = place(box.x, f, f.W, width)
  const y = place(box.y, f, f.H, height)
  return { x, y, width, height, rotation: GEOMETRY_ROTATION, crop: null }
}

// The seven look fields in pixels; a slot with no textBox gets the defaults (no box).
function lookOf(rule: TextBoxRule | undefined, f: Frame): Look {
  if (!rule) return { ...TEXT_LOOK_DEFAULTS }
  const share = (n: number) => Math.round(n * f.S)
  const { boxOutlineOfSmaller: outline, boxRadiusOfSmaller, boxPaddingOfSmaller, ...rest } = rule
  return {
    ...rest,
    boxOutlineWidth: outline > 0 ? Math.max(1, share(outline)) : 0,
    boxRadius: share(boxRadiusOfSmaller),
    boxPadding: share(boxPaddingOfSmaller),
  }
}

// A text layer's whole style: the rule's values, every look field, and the starting font size
// for this copy in this box.
export function textStyleOf(
  slot: { text: TextStyleRule; textBox?: TextBoxRule },
  copy: string | null,
  box: { width: number; height: number },
  f: Frame,
): TextStyle {
  const { fontSizeOfSmaller, ...rest } = slot.text
  const look = lookOf(slot.textBox, f)
  const fontSize = startingFontSize(
    copy,
    box,
    {
      fontSizeOfSmaller,
      lineHeight: rest.lineHeight,
      letterSpacing: rest.letterSpacing,
      allCaps: look.allCaps,
      padding: look.boxPadding,
      outline: look.boxOutlineWidth,
    },
    f,
  )
  return { ...rest, fontSize, ...look }
}
