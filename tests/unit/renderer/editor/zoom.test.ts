// spec/editor.md, "Canvas", Zoom: 'fit' or one of the fixed steps; in and out step to the next
// value from the current scale.
import { describe, expect, it } from 'vitest'
import { ZOOM_STEPS, fitScale, scaleOf, zoomIn, zoomLabel, zoomOut } from '@/renderer/editor/zoom'

describe('zoom [spec/editor.md "Canvas"]', () => {
  it('has the steps 25 to 400 %', () => {
    expect(ZOOM_STEPS).toEqual([25, 33, 50, 67, 75, 100, 150, 200, 300, 400])
  })

  it.each([
    ['a tall post in a wide area', { width: 1080, height: 1350 }, { width: 900, height: 675 }, 0.5],
    [
      'a wide post in a tall area',
      { width: 1920, height: 1080 },
      { width: 960, height: 2000 },
      0.5,
    ],
    ['a small post grows past 100 %', { width: 100, height: 50 }, { width: 400, height: 400 }, 4],
    [
      'no room gives the smallest step',
      { width: 1080, height: 1080 },
      { width: 0, height: 0 },
      0.25,
    ],
  ])('fit: %s', (_case, size, area, scale) => {
    expect(fitScale(size, area)).toBe(scale)
  })

  it('gives the scale of a zoom: fit uses the fit scale, a step is a percentage', () => {
    expect(scaleOf('fit', 0.42)).toBe(0.42)
    expect(scaleOf(150, 0.42)).toBe(1.5)
  })

  it.each([
    ['from fit between two steps', 'fit', 0.42, 50],
    ['from a step', 67, 0.42, 75],
    ['from the top step', 400, 0.42, 400],
    ['from fit exactly on a step', 'fit', 0.5, 67],
  ] as const)('zoom in %s', (_case, zoom, fit, next) => {
    expect(zoomIn(zoom, fit)).toBe(next)
  })

  it.each([
    ['from fit between two steps', 'fit', 0.42, 33],
    ['from a step', 75, 0.42, 67],
    ['from the bottom step', 25, 0.42, 25],
    ['from fit below every step', 'fit', 0.1, 25],
  ] as const)('zoom out %s', (_case, zoom, fit, next) => {
    expect(zoomOut(zoom, fit)).toBe(next)
  })

  it('labels fit "Fit" and a step "{n}%"', () => {
    expect(zoomLabel('fit')).toBe('Fit')
    expect(zoomLabel(150)).toBe('150%')
  })
})
