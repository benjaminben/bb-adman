// The fake provider's layout (spec/ai-jobs.md "The fake provider's parts"). Each item gets
// the default layout's box and text style for its slot (src/shared/config/default-layout.ts);
// an item of any other slot gets the "any other copy slot" box, one box-height lower for each
// earlier such item, kept inside the canvas.
import { fakeRun } from './run'
import type { LayoutBox, LayoutProvider } from '@/main/providers/types'
import {
  MARGIN_OF_SMALLER,
  OTHER_COPY_BOX,
  OTHER_COPY_TEXT,
  SIDE_OF_SMALLER,
  SLOT_LAYOUTS,
  type BoxRule,
  type Extent,
  type Place,
} from '@/shared/config/default-layout'

type Frame = { W: number; H: number; S: number; m: number; side: number }

function frameOf(W: number, H: number): Frame {
  const S = Math.min(W, H)
  return { W, H, S, m: Math.round(MARGIN_OF_SMALLER * S), side: Math.round(SIDE_OF_SMALLER * S) }
}

function extent(rule: Extent, f: Frame, whole: number): number {
  if (rule === 'full') return whole
  if (rule === 'inset') return whole - 2 * f.m
  if (rule === 'side') return f.side
  if ('ofSmaller' in rule) return Math.round(rule.ofSmaller * f.S)
  return Math.round(rule.ofHeight * f.H)
}

function place(rule: Place, f: Frame, whole: number, length: number): number {
  if (rule === 'zero') return 0
  if (rule === 'margin') return f.m
  if (rule === 'centre') return Math.round((whole - length) / 2)
  return Math.round(rule.ofHeight * f.H)
}

function boxOf(rule: BoxRule, f: Frame) {
  const width = extent(rule.width, f, f.W)
  const height = extent(rule.height, f, f.H)
  return { x: place(rule.x, f, f.W, width), y: place(rule.y, f, f.H, height), width, height }
}

export function fakeLayout(): LayoutProvider {
  return {
    propose: (input, opts) =>
      fakeRun(opts, () => {
        const f = frameOf(input.width, input.height)
        const color = input.palette[0] ?? '#FFFFFF'
        let others = 0
        return input.items.map(({ slot }): LayoutBox => {
          const named = SLOT_LAYOUTS[slot]
          const text = named?.text ?? OTHER_COPY_TEXT
          const box = named?.text ? boxOf(named.box, f) : boxOf(OTHER_COPY_BOX, f)
          if (!named?.text) {
            const lower = box.y + others * box.height
            box.y = Math.max(0, Math.min(lower, f.H - box.height))
            others += 1
          }
          const fontSize = Math.round(text.fontSizeOfSmaller * f.S)
          return { slot, ...box, fontSize, color, align: text.align }
        })
      }),
  }
}
