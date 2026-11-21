// spec/editor.md, "Crop mode": a press inside the crop moves it; a press on a handle resizes
// it. The moving crop is the overlay's own state, not the variant store's draft: nothing is
// sent until "Done", and the picture stays where it is while the crop moves over it.
import { useEffect, useLayoutEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react'
import type { Size } from '@/shared/scene/background-placement'
import type { Handle } from '@/renderer/editor/geometry-math'
import { moveCrop, resizeCrop, toSourceDelta, type Rect } from './crop-math'

type Args = {
  crop: Rect | null
  source: Size | null
  aspect: number
  rotation: number
  // The screen size of one source pixel.
  unit: number
  onChange: (crop: Rect) => void
}

type Drag = { grip: Handle | 'move'; start: Rect; x: number; y: number }

export function useCropDrag(args: Args) {
  const latest = useRef(args)
  useLayoutEffect(() => {
    latest.current = args
  })
  const drag = useRef<Drag | null>(null)
  const stop = useRef<() => void>(() => {})
  useEffect(() => () => stop.current(), [])

  function onMove(event: PointerEvent) {
    const d = drag.current
    const { source, aspect, rotation, unit, onChange } = latest.current
    if (!d || !source) return
    const screen = { x: event.clientX - d.x, y: event.clientY - d.y }
    const delta = toSourceDelta(screen, rotation, unit)
    onChange(
      d.grip === 'move'
        ? moveCrop(d.start, delta, source)
        : resizeCrop(d.start, d.grip, delta, source, aspect),
    )
  }

  return function press(grip: Drag['grip'], event: ReactPointerEvent) {
    event.stopPropagation()
    event.preventDefault()
    const { crop } = latest.current
    if (event.button !== 0 || drag.current || !crop) return
    const up = () => stop.current()
    stop.current = () => {
      drag.current = null
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
    drag.current = { grip, start: crop, x: event.clientX, y: event.clientY }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }
}
