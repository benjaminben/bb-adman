// P7-15: the generate_video tool names fal-seedance, says it is paid, and gives its lengths and
// its reference count, read from the offer table and the app's input cap (the smaller wins).
import { describe, it, expect } from 'vitest'
import { RUN_TOOLS } from '@/main/mcp/tools/run-tools'

const video = RUN_TOOLS.find((t) => t.name === 'generate_video')?.description ?? ''

describe('generate_video names fal.ai Seedance [P7-15]', () => {
  it.each([
    ['the provider ID', '"fal-seedance"'],
    ['that it is paid', "paid, charged to the user's fal.ai account with no click"],
    ['its lengths', 'duration_ms from 4000 to 15000, in whole seconds'],
    ['its reference count, the smaller of 9 and the cap of 8', 'at most 8 reference pictures'],
  ])('gives %s', (_what, words) => {
    expect(video).toContain(words)
  })

  it('leaves generate_images without fal', () => {
    const images = RUN_TOOLS.find((t) => t.name === 'generate_images')?.description ?? ''
    expect(images).not.toContain('fal-seedance')
  })
})
