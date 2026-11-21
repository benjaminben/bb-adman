// The free room inside the canvas area (its content box, inside the --space-6 padding), for
// the fit zoom. Without ResizeObserver (tests) the room is 0 and fit uses the smallest step.
import { useEffect, useState, type RefObject } from 'react'

export type Size = { width: number; height: number }

export function useAreaSize(area: RefObject<HTMLElement | null>): Size {
  const [size, setSize] = useState<Size>({ width: 0, height: 0 })
  useEffect(() => {
    const el = area.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return
      const { width, height } = entry.contentRect
      setSize((now) => (now.width === width && now.height === height ? now : { width, height }))
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [area])
  return size
}
