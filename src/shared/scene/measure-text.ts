import { LOOK_LIMITS } from '@/shared/schemas/layer'
import { clampTo } from '@/shared/scene/text-box-css'

// spec/scene.md "Settling and the overflow measurement", "With a text box" (LK-2): the values
// measureOverflow takes. The text element is measured against the box's area inside its
// outline (clientHeight leaves the border out) and padding, so text drawn past the top of a
// bottom-aligned box is caught. With no box values this gives the same result as before.
type Box = Pick<HTMLElement, 'clientHeight'>
type Text = Pick<HTMLElement, 'scrollWidth' | 'scrollHeight' | 'clientWidth'>

export function measuredText(box: Box, text: Text, padding: number) {
  return {
    scrollWidth: text.scrollWidth,
    scrollHeight: text.scrollHeight,
    clientWidth: text.clientWidth,
    clientHeight: box.clientHeight - 2 * clampTo(padding, LOOK_LIMITS.boxPadding),
  }
}
