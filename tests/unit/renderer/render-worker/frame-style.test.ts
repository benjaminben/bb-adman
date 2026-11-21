// P8-3 (phase-08.md "Drawing at full size"): the render page's frame transform. Without view
// the Scene is scaled to the asked width; with view it is drawn at scale 1, shifted by (-x, -y).
import { describe, it, expect } from 'vitest'
import { frameStyle } from '@/renderer/render-worker/render-root/frame-style'
import type { RenderRequest } from '@/shared/schemas/render'

const request: RenderRequest = {
  requestId: 'r1',
  input: {
    projectId: 'p1',
    variant: { width: 1200, height: 800, language: 'en', format: 'image', durationMs: 0 },
    layers: [],
    assets: {},
    timeMs: 0,
    mode: 'full',
  },
  width: 600,
  height: 400,
}
const tile = (x: number, y: number): RenderRequest => ({ ...request, width: 952, view: { x, y } })

describe('frameStyle [P8-3]', () => {
  it.each([
    ['no view: scaled to the asked width', request, 'scale(0.5)'],
    ['no view at full size: scale 1', { ...request, width: 1200, height: 800 }, 'scale(1)'],
    ['view at the corner: no shift and no scale', tile(0, 0), 'translate(0px, 0px)'],
    ['view of a later tile: shifted left and up', tile(2048, 1024), 'translate(-2048px, -1024px)'],
  ])('%s', (_case, value, transform) => {
    expect(frameStyle(value)).toEqual({ transform })
  })
})
