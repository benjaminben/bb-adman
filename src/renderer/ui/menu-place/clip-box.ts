// The box an open menu must stay inside: the window, cut down by every box around the button
// that cuts its content off (a dialog's frame, a dialog's scrolling body). A menu drawn past
// such a box's edge would be hidden, or would make the box scroll.
import type { Edges, Size } from './menu-place'

function cutsOff(el: Element): boolean {
  const style = getComputedStyle(el)
  return [style.overflowX, style.overflowY].some((value) => value !== '' && value !== 'visible')
}

export function clipBox(from: Element, view: Size): Edges {
  let box: Edges = { left: 0, top: 0, right: view.width, bottom: view.height }
  for (let el = from.parentElement; el !== null; el = el.parentElement) {
    if (!cutsOff(el)) continue
    const edges = el.getBoundingClientRect()
    box = {
      left: Math.max(box.left, edges.left),
      top: Math.max(box.top, edges.top),
      right: Math.min(box.right, edges.right),
      bottom: Math.min(box.bottom, edges.bottom),
    }
  }
  return box
}
