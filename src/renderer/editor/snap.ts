// spec/editor.md, "Snapping and guides" [FR-096]. Pure. The lines are the canvas's edges and
// centre and those of every other visible layer's axis-aligned bounds. A line within 6 screen
// pixels (6 ÷ zoom variant pixels) snaps; the nearest wins on each axis on its own.
import { boundsOf, type Bounds, type Box, type Point } from './geometry-math'

export type Lines = { x: number[]; y: number[] }
// The line each axis snapped to, in variant pixels, for its guide; null when it did not snap.
export type Guides = { x: number | null; y: number | null }

const SNAP_SCREEN_PX = 6

export function snapLines(canvas: { width: number; height: number }, others: Box[]): Lines {
  const lines: Lines = {
    x: [0, canvas.width / 2, canvas.width],
    y: [0, canvas.height / 2, canvas.height],
  }
  for (const box of others) {
    const b = boundsOf(box)
    lines.x.push(b.left, (b.left + b.right) / 2, b.right)
    lines.y.push(b.top, (b.top + b.bottom) / 2, b.bottom)
  }
  return lines
}

type Snap = { offset: number; line: number | null }

// The nearest line to any of the given positions, within reach.
function nearest(positions: number[], lines: number[], reach: number): Snap {
  let best: Snap = { offset: 0, line: null }
  let distance = reach
  for (const p of positions) {
    for (const line of lines) {
      const d = Math.abs(line - p)
      if (d <= distance && (best.line === null || d < distance)) {
        best = { offset: line - p, line }
        distance = d
      }
    }
  }
  return best
}

// While moving: the bounds' two edges and centre on each axis.
export function snapMove(bounds: Bounds, lines: Lines, zoom: number) {
  const reach = SNAP_SCREEN_PX / zoom
  const x = nearest([bounds.left, (bounds.left + bounds.right) / 2, bounds.right], lines.x, reach)
  const y = nearest([bounds.top, (bounds.top + bounds.bottom) / 2, bounds.bottom], lines.y, reach)
  const offset: Point = { x: x.offset, y: y.offset }
  const guides: Guides = { x: x.line, y: y.line }
  return { offset, guides }
}

// While resizing: only the edge each axis pulls (-1 the left or top, 1 the right or bottom).
export function snapResize(bounds: Bounds, pull: Point, lines: Lines, zoom: number) {
  const reach = SNAP_SCREEN_PX / zoom
  const out = { ...bounds }
  const guides: Guides = { x: null, y: null }
  if (pull.x !== 0) {
    const edge = pull.x > 0 ? 'right' : 'left'
    const snap = nearest([bounds[edge]], lines.x, reach)
    out[edge] += snap.offset
    guides.x = snap.line
  }
  if (pull.y !== 0) {
    const edge = pull.y > 0 ? 'bottom' : 'top'
    const snap = nearest([bounds[edge]], lines.y, reach)
    out[edge] += snap.offset
    guides.y = snap.line
  }
  return { bounds: out, guides }
}
