// P7-1: the Phase 7 refusals carry their reason and sentence, and no other detail.
import { describe, it, expect } from 'vitest'
import {
  VIDEO_REASONS,
  VIDEO_REASON_MESSAGES,
  videoLengthRefusal,
  videoRefusal,
  videoStartRefusal,
} from '@/shared/video/messages'

describe('the Phase 7 refusals [P7-1]', () => {
  it.each(VIDEO_REASONS)('%s is a RULE_VIOLATION with its one sentence', (reason) => {
    const error = videoRefusal(reason)
    expect(error).toMatchObject({ code: 'RULE_VIOLATION', details: { reason } })
    expect(error.message).toBe(VIDEO_REASON_MESSAGES[reason])
  })

  it('names the provider in the start and length refusals', () => {
    expect(videoStartRefusal('Seedance')).toMatchObject({
      code: 'RULE_VIOLATION',
      message: 'Seedance cannot start a video this way.',
      details: { reason: 'video_start_not_offered' },
    })
    expect(videoLengthRefusal('Seedance', 4, 12)).toMatchObject({
      code: 'RULE_VIOLATION',
      message: 'Seedance makes clips of 4 to 12 seconds.',
      details: { reason: 'video_length_not_offered' },
    })
  })
})
