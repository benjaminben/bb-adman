import type { CSSProperties } from 'react'
import { LOOK_LIMITS, type TextStyle } from '@/shared/schemas/layer'
import { textLookOf } from '@/shared/config/look'
import { rgbCss } from '@/shared/scene/colour-css'

// spec/scene.md "Text boxes" (LK-2): the outer box of a text layer. An outside agent can send
// these values, so none of a field's text is put in the CSS: colours go through rgbCss,
// numbers are clamped to LOOK_LIMITS and the alignment goes through a fixed table.
const JUSTIFY: Record<string, CSSProperties['justifyContent']> = {
  top: 'flex-start',
  middle: 'center',
  bottom: 'flex-end',
}

// A value that is not a finite number gives the lower bound.
export function clampTo(value: unknown, limit: { min: number; max: number }): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return limit.min
  return Math.min(limit.max, Math.max(limit.min, value))
}

export function textBoxCss(style: TextStyle): CSSProperties {
  const look = textLookOf(style)
  const align = String(look.verticalAlign)
  const width = clampTo(look.boxOutlineWidth, LOOK_LIMITS.boxOutlineWidth)
  const outline = rgbCss(look.boxOutlineColor)
  const fill = rgbCss(look.boxColor)
  return {
    display: 'flex',
    flexDirection: 'column',
    boxSizing: 'border-box',
    overflow: 'visible',
    justifyContent: Object.hasOwn(JUSTIFY, align) ? JUSTIFY[align] : 'flex-start',
    padding: `${clampTo(look.boxPadding, LOOK_LIMITS.boxPadding)}px`,
    border: outline && width > 0 ? `${width}px solid ${outline}` : 'none',
    borderRadius: `${clampTo(look.boxRadius, LOOK_LIMITS.boxRadius)}px`,
    ...(fill ? { backgroundColor: fill } : {}),
  }
}
