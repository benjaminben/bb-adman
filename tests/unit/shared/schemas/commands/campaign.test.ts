import { describe, it, expect } from 'vitest'
import { CampaignSize } from '../../../../../src/shared/schemas/commands/campaign'
import { MAX_SIZE_SIDE, MIN_SIZE_SIDE } from '../../../../../src/shared/config/size-limits'

const size = (width: number, height: number) => ({ label: `${width}x${height}`, width, height })

describe('CampaignSize: each side from 50 to 8,192 pixels [SPEC 3.3 1.26, 14 P5]', () => {
  it('reads the two bounds from size-limits.ts', () => {
    expect([MIN_SIZE_SIDE, MAX_SIZE_SIDE]).toEqual([50, 8192])
  })

  it.each([
    [50, 1080],
    [1080, 50],
    [8192, 1080],
    [1080, 8192],
  ])('allows %i by %i', (width, height) => {
    expect(CampaignSize.safeParse(size(width, height)).success).toBe(true)
  })

  it.each([
    [49, 1080],
    [1080, 49],
    [8193, 1080],
    [1080, 8193],
  ])('refuses %i by %i', (width, height) => {
    expect(CampaignSize.safeParse(size(width, height)).success).toBe(false)
  })
})
