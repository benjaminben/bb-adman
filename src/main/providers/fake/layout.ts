// The fake provider's layout (spec/ai-jobs.md "The fake provider's parts"). Each item gets
// the default layout's box and text style for its slot (src/shared/config/default-layout.ts,
// placed by src/shared/templates/layout-rules.ts), at the style's largest size; an item of any
// other slot gets the "any other copy slot" box, one box-height lower for each earlier such
// item, kept inside the canvas.
import { fakeRun } from './run'
import type { LayoutBox, LayoutProvider } from '@/main/providers/types'
import { OTHER_COPY_BOX, OTHER_COPY_TEXT, SLOT_LAYOUTS } from '@/shared/config/default-layout'
import { frameOf, geometryOf } from '@/shared/templates/layout-rules'

export function fakeLayout(): LayoutProvider {
  return {
    propose: (input, opts) =>
      fakeRun(opts, () => {
        const f = frameOf(input)
        const color = input.palette[0] ?? '#FFFFFF'
        let others = 0
        return input.items.map(({ slot }): LayoutBox => {
          const named = SLOT_LAYOUTS[slot]
          const text = named?.text ?? OTHER_COPY_TEXT
          const { x, y, width, height } = geometryOf(named?.text ? named.box : OTHER_COPY_BOX, f)
          const box = { x, y, width, height }
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
