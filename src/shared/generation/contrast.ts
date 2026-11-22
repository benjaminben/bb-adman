// WCAG 2 contrast, and the ground under a text box read from a picture (spec/phases/
// round-2-editor.md D2, "The rule" 1 to 4). Pure.
import {
  GROUND_DARK_PERCENTILE,
  GROUND_LIGHT_PERCENTILE,
  GROUND_SAMPLES,
} from '@/shared/config/contrast'

// A decoded picture: four bytes a pixel, red, green, blue, alpha.
export type Pixels = { width: number; height: number; rgba: Uint8Array }
export type Box = { x: number; y: number; width: number; height: number }
// The luminance of the ground's dark and light parts.
export type Ground = { dark: number; light: number }

function linear(channel: number): number {
  const c = channel / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

function relative(r: number, g: number, b: number): number {
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)
}

// The relative luminance of a `#RRGGBB` colour, or of r, g, b from 0 to 255.
export function luminance(hex: string): number
export function luminance(r: number, g: number, b: number): number
export function luminance(first: string | number, g = 0, b = 0): number {
  if (typeof first === 'number') return relative(first, g, b)
  const at = (i: number) => parseInt(first.slice(i, i + 2), 16)
  return relative(at(1), at(3), at(5))
}

// The contrast of two luminances, from 1 to 21.
export function contrastRatio(a: number, b: number): number {
  const [lighter, darker] = a > b ? [a, b] : [b, a]
  return (lighter + 0.05) / (darker + 0.05)
}

// How well a colour reads on a ground: its contrast with the ground's worse part.
export function readable(colour: string, ground: Ground): number {
  const l = luminance(colour)
  return Math.min(contrastRatio(l, ground.dark), contrastRatio(l, ground.light))
}

function percentile(sorted: number[], share: number): number {
  return sorted[Math.min(sorted.length - 1, Math.floor(share * sorted.length))] ?? 0
}

// The ground under a box given in the variant's pixels; `scale` takes it into the picture's.
// Null when no part of the box is inside the picture.
export function groundOf(pixels: Pixels, box: Box, scale: number): Ground | null {
  const left = Math.max(0, Math.floor(box.x * scale))
  const top = Math.max(0, Math.floor(box.y * scale))
  const right = Math.min(pixels.width, Math.ceil((box.x + box.width) * scale))
  const bottom = Math.min(pixels.height, Math.ceil((box.y + box.height) * scale))
  if (right <= left || bottom <= top) return null
  const area = (right - left) * (bottom - top)
  const step = Math.max(1, Math.floor(Math.sqrt(area / GROUND_SAMPLES)))
  const samples: number[] = []
  for (let y = top; y < bottom; y += step) {
    for (let x = left; x < right; x += step) {
      const i = (y * pixels.width + x) * 4
      const alpha = (pixels.rgba[i + 3] ?? 0) / 255
      const channel = (k: number) => (pixels.rgba[i + k] ?? 0) * alpha
      samples.push(relative(channel(0), channel(1), channel(2)))
    }
  }
  samples.sort((a, b) => a - b)
  return {
    dark: percentile(samples, GROUND_DARK_PERCENTILE),
    light: percentile(samples, GROUND_LIGHT_PERCENTILE),
  }
}
