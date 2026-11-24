// A pointer drag on one element (spec/app-style-parts.md "Swatch field", D-109): each move
// reports where the pointer is as fractions 0 to 1 across and down the element, and the
// release reports the end once. The pointer is captured, so the drag goes on outside it.
import { useRef, type PointerEvent } from 'react'

const fraction = (at: number, start: number, size: number) =>
  size > 0 ? Math.min(1, Math.max(0, (at - start) / size)) : 0

export function useDrag(onMove: (x: number, y: number) => void, onEnd: () => void) {
  const dragging = useRef<number | null>(null)

  function report(event: PointerEvent<HTMLElement>) {
    const box = event.currentTarget.getBoundingClientRect()
    onMove(
      fraction(event.clientX, box.left, box.width),
      fraction(event.clientY, box.top, box.height),
    )
  }

  return {
    onPointerDown(event: PointerEvent<HTMLElement>) {
      if (event.button !== 0) return
      event.preventDefault()
      dragging.current = event.pointerId
      event.currentTarget.focus()
      event.currentTarget.setPointerCapture?.(event.pointerId)
      report(event)
    },
    onPointerMove(event: PointerEvent<HTMLElement>) {
      if (dragging.current === event.pointerId) report(event)
    },
    onPointerUp(event: PointerEvent<HTMLElement>) {
      if (dragging.current !== event.pointerId) return
      dragging.current = null
      report(event)
      onEnd()
    },
    onPointerCancel() {
      dragging.current = null
    },
  }
}
