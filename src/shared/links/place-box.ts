// spec/make-variants.md "Anchoring": where a box that no layout placed goes in a new size.
// Lengths are in shares of the smaller side, so every gap and length is multiplied by
// k = S(new) / S(source). Each axis is handled alone. Pure.
import type { Geometry } from '@/shared/schemas/layer'
import type { Size } from '@/shared/scene/background-placement'

type Span = { start: number; length: number }

// Math.round gives -0 for small negatives; `+ 0` makes it a plain 0.
const whole = (n: number) => Math.round(n) + 0

// One axis: the box's start and length on a side of `from`, placed on a side of `to`.
function placeSpan(span: Span, from: number, to: number, k: number, stretch: boolean): Span {
  const before = span.start
  const after = from - span.start - span.length
  let next: Span
  if (stretch && before < span.length && after < span.length) {
    const start = whole(before * k)
    next = { start, length: to - start - whole(after * k) }
  } else if (Math.abs(before - after) <= 1) {
    const length = whole(span.length * k)
    next = { start: whole((to - length) / 2), length }
  } else {
    const length = whole(span.length * k)
    const start = before <= after ? whole(before * k) : to - whole(after * k) - length
    next = { start, length }
  }
  next.length = Math.max(1, next.length)
  const wasInside = before >= 0 && after >= 0
  if (!wasInside) return next
  const length = Math.min(next.length, to)
  const start = Math.min(Math.max(next.start, 0), to - length)
  return { start, length }
}

export function anchoredBox(geometry: Geometry, from: Size, to: Size, isText: boolean): Geometry {
  const k = Math.min(to.width, to.height) / Math.min(from.width, from.height)
  const x = placeSpan(
    { start: geometry.x, length: geometry.width },
    from.width,
    to.width,
    k,
    isText,
  )
  const y = placeSpan(
    { start: geometry.y, length: geometry.height },
    from.height,
    to.height,
    k,
    isText,
  )
  return { ...geometry, x: x.start, y: y.start, width: x.length, height: y.length }
}
