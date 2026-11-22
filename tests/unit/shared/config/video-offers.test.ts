// P7-11 (phase-07.md "fal.ai Seedance", A-175): the one table of video starts and lengths.
import { describe, it, expect } from 'vitest'
import { startKindOf, videoOffer, VIDEO_START_KINDS } from '@/shared/config/video-offers'
import { listProviders } from '@/main/providers/registry'

describe('videoOffer [A-175]', () => {
  it('gives fal-seedance all four starts, 4 to 15 s in whole seconds, 9 references', () => {
    expect(videoOffer('fal-seedance')).toEqual({
      starts: ['prompt', 'first_frame', 'reference', 'background'],
      minMs: 4_000,
      maxMs: 15_000,
      stepMs: 1_000,
      maxReferences: 9,
    })
  })

  it('gives the fake provider all four starts, 1 to 120 s in whole seconds, 4 references', () => {
    expect(videoOffer('fake')).toEqual({
      starts: ['prompt', 'first_frame', 'reference', 'background'],
      minMs: 1_000,
      maxMs: 120_000,
      stepMs: 1_000,
      maxReferences: 4,
    })
  })

  it.each([['comfyui'], ['gemini'], ['nope'], ['constructor'], ['__proto__'], ['toString']])(
    'gives null for %s',
    (id) => {
      expect(videoOffer(id)).toBeNull()
    },
  )

  it('has an offer for every video provider of the registry other than ComfyUI', () => {
    const video = listProviders({ ADMAN_FAKE_PROVIDERS: '1' }).filter((p) =>
      p.jobs.includes('video'),
    )
    for (const p of video) {
      if (p.id === 'comfyui') expect(videoOffer(p.id)).toBeNull()
      else expect(videoOffer(p.id), p.id).not.toBeNull()
    }
  })

  it('lists the four start kinds', () => {
    expect(VIDEO_START_KINDS).toEqual(['prompt', 'first_frame', 'reference', 'background'])
  })
})

describe('startKindOf', () => {
  it.each([
    [{ start: 'none', useReferences: false }, 'prompt'],
    [{ start: 'none', useReferences: true }, 'reference'],
    [{ start: 'first_frame', useReferences: false }, 'first_frame'],
    [{ start: 'background', useReferences: false }, 'background'],
    [{ start: 'first_frame', useReferences: true }, null],
    [{ start: 'background', useReferences: true }, null],
  ] as const)('%o is %s', (fields, kind) => {
    expect(startKindOf(fields)).toBe(kind)
  })
})
