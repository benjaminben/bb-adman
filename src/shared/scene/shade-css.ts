import type { CSSProperties } from 'react'
import { LOOK_LIMITS, type Shade } from '@/shared/schemas/layer'
import { rgbCss } from '@/shared/scene/colour-css'
import { clampTo } from '@/shared/scene/text-box-css'

// spec/scene.md "Background colour and shade" (LK-3): the CSS of the element drawn over a
// picture. An outside agent can send a shade, so none of its text is put in the CSS: the colour
// goes through rgbCss, the numbers are clamped to LOOK_LIMITS and the side through a table.
// A value that is not usable draws no shade at all.
const TOWARDS: Record<string, string> = {
  bottom: 'top',
  top: 'bottom',
  left: 'right',
  right: 'left',
}

// Each stop: where it sits as a share of the reach, and its alpha as a share of the strength.
export const SHADE_STOPS = [
  { at: 0, alpha: 1 },
  { at: 0.5, alpha: 0.45 },
  { at: 1, alpha: 0 },
] as const

const isNumber = (value: unknown) => typeof value === 'number' && Number.isFinite(value)
const percent = (share: number) => `${Number((share * 100).toFixed(4))}%`

export function shadeCss(shade: Shade | null | undefined): CSSProperties | null {
  if (!shade || !isNumber(shade.strength) || !isNumber(shade.reach)) return null
  const strength = clampTo(shade.strength, LOOK_LIMITS.shadeStrength)
  const from = String(shade.from)
  if (from === 'all') {
    const fill = rgbCss(shade.color, strength)
    return fill ? { backgroundColor: fill } : null
  }
  if (!Object.hasOwn(TOWARDS, from)) return null
  const reach = clampTo(shade.reach, LOOK_LIMITS.shadeReach)
  const stops = SHADE_STOPS.map(({ at, alpha }) => {
    const colour = rgbCss(shade.color, strength * alpha)
    return colour && `${colour} ${percent(reach * at)}`
  })
  if (stops.some((stop) => !stop)) return null
  return { backgroundImage: `linear-gradient(to ${TOWARDS[from]}, ${stops.join(', ')})` }
}
