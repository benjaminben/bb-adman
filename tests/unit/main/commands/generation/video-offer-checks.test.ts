// P7-11 (phase-07.md "fal.ai Seedance" and "The format switch and the start"; security class):
// the offer check refuses a start kind, a length or a reference count outside the table.
import { describe, it, expect } from 'vitest'
import { checkVideoOffer } from '@/main/commands/generation/video-offer-checks'
import { videoOffer, type VideoOffer } from '@/shared/config/video-offers'

const FAL = videoOffer('fal-seedance') as VideoOffer
const FAKE = videoOffer('fake') as VideoOffer
const LABEL = 'fal.ai Seedance'

type Start = 'none' | 'first_frame' | 'background'
const ask = (durationMs: number, start: Start = 'none', useReferences = false, refs = 0) => ({
  durationMs,
  start,
  useReferences,
  referenceAssetIds: Array.from({ length: refs }, (_, i) => `a${i}`),
})

const refusal = (fn: () => void) => {
  try {
    fn()
  } catch (e) {
    return e as { code: string; message: string; details?: Record<string, unknown> }
  }
  return null
}

describe('checkVideoOffer [A-175] (security class)', () => {
  it.each([
    ['the shortest fal clip', ask(4_000)],
    ['the longest fal clip', ask(15_000)],
    ['a first frame', ask(8_000, 'first_frame', false, 1)],
    ['a background start', ask(8_000, 'background')],
    ['nine references', ask(8_000, 'none', true, 9)],
  ])('takes %s', (_, input) => {
    expect(refusal(() => checkVideoOffer(LABEL, FAL, input))).toBeNull()
  })

  it.each([
    ['3 s', 3_000],
    ['15.001 s', 15_001],
    ['16 s', 16_000],
    ['4.5 s, between whole seconds', 4_500],
  ])('refuses a fal clip of %s: video_length_not_offered', (_, ms) => {
    expect(refusal(() => checkVideoOffer(LABEL, FAL, ask(ms)))).toMatchObject({
      code: 'RULE_VIOLATION',
      message: 'fal.ai Seedance makes clips of 4 to 15 seconds.',
      details: { reason: 'video_length_not_offered' },
    })
  })

  it.each([
    ['fal', FAL, 10, 9],
    ['fake', FAKE, 5, 4],
  ] as const)('refuses too many references on %s: too_many_references', (_, offer, n, max) => {
    expect(refusal(() => checkVideoOffer(LABEL, offer, ask(4_000, 'none', true, n)))).toEqual(
      expect.objectContaining({
        code: 'RULE_VIOLATION',
        message: `fal.ai Seedance takes at most ${max} reference pictures for a video.`,
        details: { reason: 'too_many_references', max },
      }),
    )
  })

  it.each([
    ['a first frame with references', ask(4_000, 'first_frame', true, 1)],
    ['a background with references', ask(4_000, 'background', true, 1)],
  ])('refuses %s: video_start_not_offered', (_, input) => {
    expect(refusal(() => checkVideoOffer(LABEL, FAL, input))).toMatchObject({
      code: 'RULE_VIOLATION',
      message: 'fal.ai Seedance cannot start a video this way.',
      details: { reason: 'video_start_not_offered' },
    })
  })

  it('refuses a start kind the offer leaves out', () => {
    const promptOnly: VideoOffer = { ...FAL, starts: ['prompt'] }
    for (const input of [
      ask(4_000, 'first_frame', false, 1),
      ask(4_000, 'none', true, 1),
      ask(4_000, 'background'),
    ]) {
      expect(refusal(() => checkVideoOffer(LABEL, promptOnly, input))).toMatchObject({
        details: { reason: 'video_start_not_offered' },
      })
    }
  })
})
