// clampLayout (spec/ai-jobs.md "Layout proposal", step 5): turns the boxes a layout provider
// answered into boxes that fit the variant. Pure, so the job and its tests share it.
import type { LayoutJobBox } from '@/shared/schemas/jobs/layout-proposal'

// A box as the model answered it: any number, any colour text, any align text.
export type RawLayoutBox = {
  slot: string
  x: number
  y: number
  width: number
  height: number
  fontSize: number
  color: string
  align: string
}

export type LayoutLimits = { width: number; height: number; palette: string[]; keys: string[] }

const HEX = /^#[0-9A-Fa-f]{6}$/
const ALIGNS = new Set(['left', 'center', 'right'])
const NUMBERS = ['x', 'y', 'width', 'height', 'fontSize'] as const

const clamp = (value: number, low: number, high: number) => Math.min(Math.max(value, low), high)

function channels(hex: string): number[] {
  return [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16))
}

// The palette colour with the smallest sum of squared red, green and blue differences.
function nearest(color: string, palette: string[]): string {
  const want = channels(color)
  const distance = (hex: string) =>
    channels(hex).reduce((sum, value, i) => sum + (value - (want[i] ?? 0)) ** 2, 0)
  return palette.reduce((best, hex) => (distance(hex) < distance(best) ? hex : best))
}

function colorOf(color: string, palette: string[]): string | null {
  if (!HEX.test(color)) return null
  const valid = palette.filter((hex) => HEX.test(hex))
  return (valid.length > 0 ? nearest(color, valid) : color).toUpperCase()
}

function fit(raw: RawLayoutBox, limits: LayoutLimits): LayoutJobBox {
  const x = clamp(Math.round(raw.x), 0, limits.width - 1)
  const y = clamp(Math.round(raw.y), 0, limits.height - 1)
  return {
    slot: raw.slot,
    x,
    y,
    width: clamp(Math.round(raw.width), 1, limits.width - x),
    height: clamp(Math.round(raw.height), 1, limits.height - y),
    fontSize: clamp(Math.round(raw.fontSize), 1, limits.height),
    color: colorOf(raw.color, limits.palette),
    align: ALIGNS.has(raw.align) ? (raw.align as LayoutJobBox['align']) : 'center',
  }
}

export function clampLayout(boxes: RawLayoutBox[], limits: LayoutLimits): LayoutJobBox[] {
  const known = new Set(limits.keys)
  const seen = new Set<string>()
  const firsts = boxes.filter((raw) => {
    if (!known.has(raw.slot) || seen.has(raw.slot)) return false
    seen.add(raw.slot)
    return true
  })
  return firsts
    .filter((raw) => NUMBERS.every((field) => Number.isFinite(raw[field])))
    .map((raw) => fit(raw, limits))
}
