import { describe, it, expect } from 'vitest'
import {
  CUSTOM_WORKFLOW_ID,
  CUSTOM_SIZE_DEFAULTS,
  CUSTOM_VIDEO_DEFAULT,
  MAX_CUSTOM_WORKFLOWS,
  MAX_WORKFLOW_BYTES,
  MAX_WORKFLOW_NODES,
  MAX_MEGAPIXEL_OPTIONS,
  SIZE_MULTIPLES,
  isAllowedSize,
  isAllowedVideo,
  sizeFromChoice,
  workflowIdSchema,
} from '@/shared/comfy/custom-workflow'
import { WORKFLOW_IDS } from '@/shared/schemas/queries/comfy'

describe('the custom workflow ID form [D-104]', () => {
  it('accepts custom- plus 12 lowercase hex characters', () => {
    expect(CUSTOM_WORKFLOW_ID.test('custom-0123456789ab')).toBe(true)
    expect(workflowIdSchema.safeParse('custom-a1b2c3d4e5f6').success).toBe(true)
  })

  it.each([
    'custom-../x',
    'custom-0123456789AB',
    'custom-0123456789a',
    'custom-0123456789abc',
    'custom-0123456789ag',
    'Custom-0123456789ab',
    ' custom-0123456789ab',
    'custom-0123456789ab\n',
  ])('refuses %j', (id) => {
    expect(CUSTOM_WORKFLOW_ID.test(id)).toBe(false)
    expect(workflowIdSchema.safeParse(id).success).toBe(false)
  })

  it('workflowIdSchema accepts every shipped ID and nothing else', () => {
    for (const id of WORKFLOW_IDS) expect(workflowIdSchema.parse(id)).toBe(id)
    expect(workflowIdSchema.safeParse('moss-text-to-video').success).toBe(false)
    expect(workflowIdSchema.safeParse(7).success).toBe(false)
  })
})

describe('the limits and defaults of the stored shape', () => {
  it('holds the limits the spec names', () => {
    expect(MAX_CUSTOM_WORKFLOWS).toBe(50)
    expect(MAX_WORKFLOW_BYTES).toBe(2 * 1024 * 1024)
    expect(MAX_WORKFLOW_NODES).toBe(500)
  })

  it('holds the size and video defaults', () => {
    expect(CUSTOM_SIZE_DEFAULTS.image).toEqual({
      multiple: 16,
      minPixels: 838_861,
      maxPixels: 1_048_576,
    })
    expect(CUSTOM_SIZE_DEFAULTS.image_refs).toEqual(CUSTOM_SIZE_DEFAULTS.image)
    expect(CUSTOM_SIZE_DEFAULTS.video).toEqual({
      multiple: 32,
      minPixels: 327_680,
      maxPixels: 409_600,
    })
    expect(CUSTOM_VIDEO_DEFAULT).toEqual({ fps: 24, maxMs: 5_000, frameStep: 4, frameOffset: 1 })
  })
})

describe('the size options', () => {
  it('makes a rule from a multiple and a largest size, the smallest 80% rounded up', () => {
    expect(sizeFromChoice(32, 0.25)).toEqual({
      multiple: 32,
      minPixels: 209_716,
      maxPixels: 262_144,
    })
    expect(sizeFromChoice(8, 0.5)).toEqual({ multiple: 8, minPixels: 419_431, maxPixels: 524_288 })
    expect(sizeFromChoice(64, 2)).toEqual({
      multiple: 64,
      minPixels: 1_677_722,
      maxPixels: 2_097_152,
    })
    expect(sizeFromChoice(8, 4)).toEqual({
      multiple: 8,
      minPixels: 3_355_444,
      maxPixels: 4_194_304,
    })
  })

  it('takes 0.4 as exactly 640 × 640 pixels', () => {
    expect(sizeFromChoice(16, 0.4)).toEqual({
      multiple: 16,
      minPixels: 327_680,
      maxPixels: 409_600,
    })
  })

  it('makes each default from the options', () => {
    expect(sizeFromChoice(16, 1)).toEqual(CUSTOM_SIZE_DEFAULTS.image)
    expect(sizeFromChoice(16, 1)).toEqual(CUSTOM_SIZE_DEFAULTS.image_refs)
    expect(sizeFromChoice(32, 0.4)).toEqual(CUSTOM_SIZE_DEFAULTS.video)
  })

  it('refuses a multiple or a largest size outside the lists', () => {
    expect(() => sizeFromChoice(12, 1)).toThrow()
    expect(() => sizeFromChoice(16, 3)).toThrow()
    expect(() => sizeFromChoice(16, 0.39)).toThrow()
  })

  it('allows every option, and nothing else', () => {
    for (const multiple of SIZE_MULTIPLES) {
      for (const mp of MAX_MEGAPIXEL_OPTIONS) {
        expect(isAllowedSize(sizeFromChoice(multiple, mp))).toBe(true)
      }
    }
    expect(MAX_MEGAPIXEL_OPTIONS).toEqual([0.25, 0.4, 0.5, 1, 2, 4])
    expect(isAllowedSize({ multiple: 16, minPixels: 1, maxPixels: 1_048_576 })).toBe(false)
    expect(isAllowedSize({ multiple: 16, minPixels: 838_860, maxPixels: 1_048_576 })).toBe(false)
    expect(isAllowedSize({ multiple: 7, minPixels: 838_861, maxPixels: 1_048_576 })).toBe(false)
    expect(isAllowedSize({ multiple: 16, minPixels: 400_000, maxPixels: 500_000 })).toBe(false)
  })

  it('allows video values only within their ranges', () => {
    expect(isAllowedVideo(CUSTOM_VIDEO_DEFAULT)).toBe(true)
    expect(isAllowedVideo({ fps: 60, maxMs: 60_000, frameStep: 64, frameOffset: 0 })).toBe(true)
    expect(isAllowedVideo({ fps: 1, maxMs: 1_000, frameStep: 1, frameOffset: 64 })).toBe(true)
    for (const bad of [
      { fps: 0 },
      { fps: 61 },
      { fps: 24.5 },
      { maxMs: 999 },
      { maxMs: 60_001 },
      { maxMs: 1_500 },
      { frameStep: 0 },
      { frameStep: 65 },
      { frameOffset: -1 },
      { frameOffset: 65 },
    ]) {
      expect(isAllowedVideo({ ...CUSTOM_VIDEO_DEFAULT, ...bad })).toBe(false)
    }
  })
})
