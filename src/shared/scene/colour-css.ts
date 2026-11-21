// The only way a look colour becomes CSS (LK-1; spec/scene.md "Text boxes"). The CSS is built
// from three whole numbers read out of an exact #RRGGBB value, so no caller's text reaches a
// style. Anything else gives null, and the caller draws nothing for that part.
import { HEX_COLOUR } from '@/shared/schemas/layer'

// Alpha is clamped to 0..1 and written with at most 4 decimals; one that is not finite gives null.
export function rgbCss(hex: string | null | undefined, alpha?: number): string | null {
  if (typeof hex !== 'string' || !HEX_COLOUR.test(hex)) return null
  const [r, g, b] = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16))
  if (alpha === undefined) return `rgb(${r} ${g} ${b})`
  if (!Number.isFinite(alpha)) return null
  const a = Number(Math.min(1, Math.max(0, alpha)).toFixed(4))
  return `rgb(${r} ${g} ${b} / ${a})`
}
