// ED-2: the swatches for a colour field. The campaign palette, then the layer's own colour when
// the palette lacks it, so the chosen colour always shows as the pressed swatch (state always
// shown). Only an exact #RRGGBB is added; the swatch field draws nothing else as CSS.
import { HEX_COLOUR } from '@/shared/schemas/layer'

export function withCurrent(palette: string[], value: string | null): string[] {
  if (value === null || !HEX_COLOUR.test(value)) return palette
  const known = palette.some((hex) => hex.toLowerCase() === value.toLowerCase())
  return known ? palette : [...palette, value]
}
