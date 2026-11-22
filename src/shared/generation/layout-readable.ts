// keepReadable (spec/phases/round-2-editor.md D2, "The rule" 3 to 6): after clampLayout, each
// box keeps its colour when it reads on the picture under it, else takes the brand colour (or
// white or black) that reads best, else gets a solid text box behind it. Pure.
import { BOX_PADDING_SHARE, TEXT_CONTRAST_MIN } from '@/shared/config/contrast'
import {
  contrastRatio,
  groundOf,
  luminance,
  readable,
  type Ground,
  type Pixels,
} from '@/shared/generation/contrast'
import type { LayoutJobBox } from '@/shared/schemas/jobs/layout-proposal'
import { HEX_COLOUR, LOOK_LIMITS } from '@/shared/schemas/layer'

// What the check needs of a text layer: its key and the colours it draws with.
export type ReadableLayer = {
  key: string
  type: string
  style: { color?: string; boxColor?: string | null; boxPadding?: number }
}

export type ReadableInput = {
  pixels: Pixels
  // Takes the variant's pixels into the picture's: picture width over variant width.
  scale: number
  palette: string[]
  layers: ReadableLayer[]
}

const WHITE = '#FFFFFF'
const BLACK = '#000000'

const reaches = (ratio: number) => ratio >= TEXT_CONTRAST_MIN

// The colour of `candidates` with the highest score, if it reaches the bar.
function best(candidates: string[], score: (c: string) => number): string | null {
  let top: string | null = null
  let topScore = -1
  for (const c of candidates) {
    const s = score(c)
    if (s > topScore) [top, topScore] = [c, s]
  }
  return top !== null && reaches(topScore) ? top : null
}

function boxPaddingOf(own: number | undefined, fontSize: number): number {
  const padding = own !== undefined && own > 0 ? own : Math.round(BOX_PADDING_SHARE * fontSize)
  const { min, max } = LOOK_LIMITS.boxPadding
  return Math.min(max, Math.max(min, padding))
}

function withTextBox(box: LayoutJobBox, text: string, brand: string[], own?: number) {
  const withText = (c: string) => contrastRatio(luminance(c), luminance(text))
  const order = [...brand].sort((a, b) => withText(b) - withText(a))
  const fill = [...order, BLACK, WHITE].find((c) => reaches(withText(c)))
  const boxPadding = boxPaddingOf(own, box.fontSize)
  if (fill === undefined) {
    return { ...box, color: WHITE, boxColor: BLACK, boxPadding, readable: 'box' as const }
  }
  return { ...box, boxColor: fill, boxPadding, readable: 'box' as const }
}

function oneBox(box: LayoutJobBox, input: ReadableInput, brand: string[]): LayoutJobBox {
  const layer = input.layers.find((l) => l.type === 'text' && l.key === box.slot)
  const own = layer?.style.color
  if (!layer || own === undefined) return box
  const textBox = layer.style.boxColor ?? null
  const ground: Ground | null =
    textBox !== null
      ? { dark: luminance(textBox), light: luminance(textBox) }
      : groundOf(input.pixels, box, input.scale)
  const text = box.color ?? own
  if (ground === null || reaches(readable(text, ground))) return { ...box, readable: 'kept' }
  const score = (c: string) => readable(c, ground)
  const colour = best(brand, score) ?? best([WHITE, BLACK], score)
  if (colour !== null) return { ...box, color: colour, readable: 'colour' }
  return withTextBox(box, text, brand, layer.style.boxPadding)
}

export function keepReadable(boxes: LayoutJobBox[], input: ReadableInput): LayoutJobBox[] {
  const brand = input.palette.filter((c) => HEX_COLOUR.test(c))
  return boxes.map((box) => oneBox(box, input, brand))
}
