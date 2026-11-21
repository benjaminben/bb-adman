// P8-3 (phase-08.md "Drawing at full size"): a render request may name one tile of a big
// variant with view. With view it is checked as strictly as without, and the variant is bounded.
import { describe, it, expect } from 'vitest'
import { RenderRequest } from '@/shared/schemas/render'
import { RENDER_LIMITS } from '@/shared/config/render'
import { MAX_SIZE_SIDE } from '@/shared/config/size-limits'

const variant = { width: 3000, height: 1000, language: 'en', format: 'image', durationMs: 0 }
const input = { projectId: 'p1', variant, layers: [], assets: {}, timeMs: 0, mode: 'full' }
const tile = { requestId: '01jabc', input, width: 2048, height: 1000, view: { x: 0, y: 0 } }
const noView = { requestId: '01jabc', input, width: 512, height: 171 }
const sized = <T extends object>(request: T, width: number, height: number) => ({
  ...request,
  input: { ...input, variant: { ...variant, width, height } },
})

describe('RenderRequest with view [P8-3, Drawing at full size]', () => {
  it.each([
    ['no view, as before', noView, true],
    ['no view with a variant past 8,192: scaled down, as before', sized(noView, 10_000, 900), true],
    ['the first tile', tile, true],
    ['the second tile', { ...tile, width: 952, view: { x: 2048, y: 0 } }, true],
    ['the last start a side allows', { ...tile, view: { x: MAX_SIZE_SIDE - 1, y: 0 } }, true],
    ['a negative x', { ...tile, view: { x: -1, y: 0 } }, false],
    ['a negative y', { ...tile, view: { x: 0, y: -1 } }, false],
    ['a fractional x', { ...tile, view: { x: 0.5, y: 0 } }, false],
    ['a fractional y', { ...tile, view: { x: 0, y: 2.25 } }, false],
    ['an x of 8,192', { ...tile, view: { x: MAX_SIZE_SIDE, y: 0 } }, false],
    ['a y of 8,192', { ...tile, view: { x: 0, y: MAX_SIZE_SIDE } }, false],
    ['an x that is not a number', { ...tile, view: { x: '10', y: 0 } }, false],
    ['an infinite x', { ...tile, view: { x: Infinity, y: 0 } }, false],
    ['a view with an extra key', { ...tile, view: { x: 0, y: 0, scale: 2 } }, false],
    ['a view missing y', { ...tile, view: { x: 0 } }, false],
    ['a view that is null', { ...tile, view: null }, false],
    ['a tile wider than the window', { ...tile, width: RENDER_LIMITS.maxDimension + 1 }, false],
    ['a tile of width 0', { ...tile, width: 0 }, false],
    ['a variant of 8,192 a side', sized(tile, MAX_SIZE_SIDE, MAX_SIZE_SIDE), true],
    ['a variant wider than 8,192', sized(tile, MAX_SIZE_SIDE + 1, 1000), false],
    ['a variant taller than 8,192', sized(tile, 3000, MAX_SIZE_SIDE + 1), false],
    ['an extra key beside view', { ...tile, scale: 1 }, false],
  ])('%s', (_case, value, accepted) => {
    expect(RenderRequest.safeParse(value).success).toBe(accepted)
  })

  it('keeps view exactly as sent, and adds nothing to a request without it', () => {
    const second = { ...tile, width: 952, view: { x: 2048, y: 0 } }
    expect(RenderRequest.parse(second).view).toEqual({ x: 2048, y: 0 })
    expect('view' in RenderRequest.parse(noView)).toBe(false)
  })
})
