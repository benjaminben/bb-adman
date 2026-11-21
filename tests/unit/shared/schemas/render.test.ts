// P3-0: the render window's messages (spec/scene.md, "One draw") and RENDER_LIMITS.
import { describe, it, expect } from 'vitest'
import { RENDER_CHANNELS, RenderDone, RenderRequest } from '@/shared/schemas/render'
import { RENDER_LIMITS } from '@/shared/config/render'

const input = {
  projectId: 'p1',
  variant: { width: 1080, height: 1080, language: 'en', format: 'image', durationMs: 0 },
  layers: [],
  assets: { a1: { kind: 'image', missing: false, width: 10, height: 10 } },
  timeMs: 0,
  mode: 'full',
}
const request = { requestId: '01jabc', input, width: 512, height: 512 }

describe('render limits and channels [spec/scene.md, One draw]', () => {
  it('holds the time limit, the largest side and the thumbnail side', () => {
    expect(RENDER_LIMITS).toEqual({ timeMs: 10_000, maxDimension: 2048, thumbnailSide: 512 })
  })

  it('names the two channels', () => {
    expect(RENDER_CHANNELS).toEqual({
      request: 'adman:render-request',
      done: 'adman:render-done',
    })
  })
})

describe('RenderRequest and RenderDone [spec/scene.md, One draw]', () => {
  it.each([
    ['a valid request', request, true],
    ['a width of 0', { ...request, width: 0 }, false],
    ['a height past the limit', { ...request, height: RENDER_LIMITS.maxDimension + 1 }, false],
    ['an asset with an address', withAsset({ url: 'adman-asset://x' }), false],
    ['an unknown mode', { ...request, input: { ...input, mode: 'half' } }, false],
  ])('request: %s', (_case, value, accepted) => {
    expect(RenderRequest.safeParse(value).success).toBe(accepted)
  })

  it.each([
    ['a valid reply', { requestId: 'r1', overflow: { l1: true } }, true],
    ['a reply with an extra key', { requestId: 'r1', overflow: {}, png: 'x' }, false],
    ['an overflow that is not a boolean', { requestId: 'r1', overflow: { l1: 'yes' } }, false],
    ['no requestId', { overflow: {} }, false],
  ])('done: %s', (_case, value, accepted) => {
    expect(RenderDone.safeParse(value).success).toBe(accepted)
  })
})

function withAsset(extra: object) {
  const asset = { kind: 'image', missing: false, width: null, height: null, ...extra }
  return { ...request, input: { ...input, assets: { a1: asset } } }
}
