// P7-20: a press on a clip block or one of its ends, followed until the release. It reports
// how far the pointer moved across the lane in pixels, while moving and once at the end.
import { useEffect, useRef, type PointerEvent } from 'react'

export type DragHandlers = { move: (dx: number) => void; done: (dx: number) => void }

export function useDrag() {
  const endDrag = useRef<(() => void) | null>(null)
  useEffect(() => () => endDrag.current?.(), [])

  return function start(event: PointerEvent<HTMLElement>, handlers: DragHandlers) {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.focus()
    endDrag.current?.()
    const from = event.clientX
    const move = (e: globalThis.PointerEvent) => handlers.move(e.clientX - from)
    const up = (e: globalThis.PointerEvent) => {
      endDrag.current?.()
      handlers.done(e.clientX - from)
    }
    const cancel = () => {
      endDrag.current?.()
      handlers.done(0)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', cancel)
    endDrag.current = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', cancel)
      endDrag.current = null
    }
  }
}
