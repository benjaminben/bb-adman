import { describe, it, expect } from 'vitest'
import { plainMessage } from '@/main/providers/messages'
import { PROVIDER_ERROR_KINDS } from '@/shared/schemas/queries/app'

describe('plainMessage: one sentence per error kind [SPEC 6 plain messages, FR-069]', () => {
  it.each([
    ['bad_key', 'Google Gemini did not accept your key. Check it in Settings and try again.'],
    [
      'quota',
      'Your Google Gemini account has reached its limit. Check your plan with Google Gemini, then try again.',
    ],
    [
      'refused',
      'Google Gemini declined this request because of its content rules. Change the prompt or the images and try again.',
    ],
    ['timeout', 'Google Gemini took too long to answer. Try again.'],
    [
      'offline',
      'The app could not reach Google Gemini. Check your internet connection and try again.',
    ],
    ['other', 'Google Gemini could not finish this request. Try again.'],
  ] as const)('gives the Section 6 sentence for %s', (kind, message) => {
    expect(plainMessage(kind, 'Google Gemini')).toBe(message)
  })

  it('has a sentence for every kind in PROVIDER_ERROR_KINDS', () => {
    for (const kind of PROVIDER_ERROR_KINDS) {
      expect(plainMessage(kind, 'X')).toContain('X')
    }
  })
})
