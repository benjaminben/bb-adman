// spec/editor.md, "Canvas", Zoom: 'fit' (the largest scale at which the variant fits the free
// area) or one of the fixed steps, in percent. In and out step to the next value from the
// current scale. Pure: no React.
export const ZOOM_STEPS = [25, 33, 50, 67, 75, 100, 150, 200, 300, 400] as const

export type Zoom = 'fit' | number

type Size = { width: number; height: number }

const LOWEST = ZOOM_STEPS[0]
const HIGHEST = ZOOM_STEPS[ZOOM_STEPS.length - 1] ?? LOWEST
const SMALLEST = LOWEST / 100

// The area is the room inside the canvas's margin. With no room at all the smallest step is
// used, so the canvas never draws at size 0.
export function fitScale(size: Size, area: Size): number {
  const scale = Math.min(area.width / size.width, area.height / size.height)
  return scale > 0 ? scale : SMALLEST
}

export function scaleOf(zoom: Zoom, fit: number): number {
  return zoom === 'fit' ? fit : zoom / 100
}

// A step equal to the current scale (to the nearest whole percent) is not a step away.
function percentOf(zoom: Zoom, fit: number): number {
  return Math.round(scaleOf(zoom, fit) * 100)
}

export function zoomIn(zoom: Zoom, fit: number): number {
  const now = percentOf(zoom, fit)
  return ZOOM_STEPS.find((step) => step > now) ?? HIGHEST
}

export function zoomOut(zoom: Zoom, fit: number): number {
  const now = percentOf(zoom, fit)
  return [...ZOOM_STEPS].reverse().find((step) => step < now) ?? LOWEST
}

export function zoomLabel(zoom: Zoom): string {
  return zoom === 'fit' ? 'Fit' : `${zoom}%`
}
