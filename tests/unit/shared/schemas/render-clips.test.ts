// P7-8: a render request carries a video variant's clips and their video assets
// (phase-07.md "Clips and the track"). Every clip number is a whole millisecond on the track.
import { describe, expect, it } from 'vitest'
import { RenderRequest } from '@/shared/schemas/render'
import { MAX_TRACK_MS } from '@/shared/schemas/commands/clip'

const clip = {
  id: 'c1',
  assetId: 'a1',
  startMs: 0,
  inMs: 0,
  outMs: 1000,
  placement: null,
  soundOn: true,
}
const input = {
  projectId: 'p1',
  variant: { width: 400, height: 400, language: 'en', format: 'video', durationMs: 4000 },
  layers: [],
  assets: { a1: { kind: 'video', missing: false, width: 64, height: 64 } },
  timeMs: 500,
  mode: 'full',
  clips: [clip],
}
const request = (over: Record<string, unknown>, clipOver: Record<string, unknown> = {}) => ({
  requestId: 'r1',
  input: { ...input, clips: [{ ...clip, ...clipOver }], ...over },
  width: 400,
  height: 400,
})
const placement = { x: 0, y: 0, width: 100, height: 100, rotation: 0, crop: null }

describe('RenderRequest clips [P7-8]', () => {
  it.each([
    ['a clip on a video asset', request({}), true],
    ['no clips at all', request({ clips: undefined }), true],
    ['an empty track', request({ clips: [] }), true],
    ['a clip with a placement', request({}, { placement }), true],
    ['a start with a fraction', request({}, { startMs: 0.5 }), false],
    ['a negative in', request({}, { inMs: -1 }), false],
    ['an out past the track', request({}, { outMs: MAX_TRACK_MS + 1 }), false],
    ['an empty asset ID', request({}, { assetId: '' }), false],
    ['an extra key on a clip', request({}, { url: 'adman-asset://x' }), false],
    ['a sound flag that is not a boolean', request({}, { soundOn: 1 }), false],
  ])('%s', (_name, value, accepted) => {
    expect(RenderRequest.safeParse(value).success).toBe(accepted)
  })

  it('still refuses an audio asset', () => {
    const audio = { a1: { kind: 'audio', missing: false, width: null, height: null } }
    expect(RenderRequest.safeParse(request({ assets: audio })).success).toBe(false)
  })
})
