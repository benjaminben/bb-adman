// SPEC 3.3 CampaignSize and the ready-made sizes rule [1.8], FR-032. Pure.
// "a:b" is a ratio whose shorter side becomes 1080 pixels; "WxH" is a pixel size. A size
// whose pixels equal a ready-made size takes that size's label; a ready-made label typed
// as is ("4x5") means that size. This file holds no size of its own (SPEC 3.3).
import type { CampaignSize } from '../schemas/commands/campaign'
import type { ParseSize } from '../templates/types'
import { READY_MADE_SIZES } from '../config/defaults'

const SHORTER_SIDE = 1080
const RATIO = /^(\d+)\s*:\s*(\d+)$/
const PIXELS = /^(\d+)\s*[xX×]\s*(\d+)$/

function whole(digits: string): number | null {
  const n = Number(digits)
  return Number.isSafeInteger(n) && n > 0 ? n : null
}

function sized(width: number, height: number): CampaignSize | null {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height)) return null
  const ready = READY_MADE_SIZES.find((s) => s.width === width && s.height === height)
  return { label: ready ? ready.label : `${width}x${height}`, width, height }
}

function fromRatio(a: number, b: number): CampaignSize | null {
  if (a <= b) return sized(SHORTER_SIDE, Math.round((SHORTER_SIDE * b) / a))
  return sized(Math.round((SHORTER_SIDE * a) / b), SHORTER_SIDE)
}

export const parseSize: ParseSize = (text) => {
  const trimmed = text.trim()
  const ready = READY_MADE_SIZES.find((s) => s.label === trimmed)
  if (ready) return { label: ready.label, width: ready.width, height: ready.height }
  const ratio = RATIO.exec(trimmed)
  const pixels = ratio ? null : PIXELS.exec(trimmed)
  const match = ratio ?? pixels
  if (!match) return null
  const [, a = '', b = ''] = match
  const first = whole(a)
  const second = whole(b)
  if (first === null || second === null) return null
  return ratio ? fromRatio(first, second) : sized(first, second)
}
