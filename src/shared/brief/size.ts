// SPEC 3.3 CampaignSize and the ready-made sizes rule [1.8], FR-032. Pure.
// "a:b" is a ratio whose shorter side becomes 1080 pixels; its parts may have decimals
// [1.23]. "WxH" is a pixel size in whole numbers, unless both are below 100: then it is the
// ratio "W:H" [1.23]. A size whose pixels equal a ready-made size takes that size's label;
// a ready-made label typed as is ("4x5") means that size. Each side is from MIN_SIZE_SIDE to
// MAX_SIZE_SIDE [1.26], or the answer is null. This file holds no size of its own (SPEC 3.3).
import type { CampaignSize } from '../schemas/commands/campaign'
import type { ParseSize } from '../templates/types'
import { READY_MADE_SIZES } from '../config/defaults'
import { MAX_SIZE_SIDE, MIN_SIZE_SIDE } from '../config/size-limits'

const SHORTER_SIDE = 1080
const SMALLEST_PIXEL_SIDE = 100
const RATIO = /^(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)$/
const PIXELS = /^(\d+)\s*[xX×]\s*(\d+)$/

function whole(digits: string): number | null {
  const n = Number(digits)
  return Number.isSafeInteger(n) && n > 0 ? n : null
}

function part(digits: string): number | null {
  const n = Number(digits)
  return Number.isFinite(n) && n > 0 ? n : null
}

function inRange(side: number): boolean {
  return Number.isSafeInteger(side) && side >= MIN_SIZE_SIDE && side <= MAX_SIZE_SIDE
}

function sized(width: number, height: number): CampaignSize | null {
  if (!inRange(width) || !inRange(height)) return null
  const ready = READY_MADE_SIZES.find((s) => s.width === width && s.height === height)
  return { label: ready ? ready.label : `${width}x${height}`, width, height }
}

function fromRatio(a: number, b: number): CampaignSize | null {
  if (a <= b) return sized(SHORTER_SIDE, Math.round((SHORTER_SIDE * b) / a))
  return sized(Math.round((SHORTER_SIDE * a) / b), SHORTER_SIDE)
}

function ratioOf(a: number | null, b: number | null): CampaignSize | null {
  return a === null || b === null ? null : fromRatio(a, b)
}

export const parseSize: ParseSize = (text) => {
  const trimmed = text.trim()
  const ready = READY_MADE_SIZES.find((s) => s.label === trimmed)
  if (ready) return { label: ready.label, width: ready.width, height: ready.height }
  const ratio = RATIO.exec(trimmed)
  if (ratio) return ratioOf(part(ratio[1] ?? ''), part(ratio[2] ?? ''))
  const pixels = PIXELS.exec(trimmed)
  if (!pixels) return null
  const width = whole(pixels[1] ?? '')
  const height = whole(pixels[2] ?? '')
  if (width === null || height === null) return null
  if (width < SMALLEST_PIXEL_SIDE && height < SMALLEST_PIXEL_SIDE) return fromRatio(width, height)
  return sized(width, height)
}
