import { describe, it, expect } from 'vitest'
import { plainMessage } from '../../../../src/shared/providers/messages'
import { plainMessage as mainPlainMessage } from '../../../../src/main/providers/messages'
import { PROVIDER_ERROR_KINDS } from '../../../../src/shared/schemas/queries/app'

describe('plainMessage lives in src/shared so the window can import it [SPEC 14 1.41 TP-0]', () => {
  it('gives the Section 6 sentence from the shared file', () => {
    expect(plainMessage('timeout', 'Google Gemini')).toBe(
      'Google Gemini took too long to answer. Try again.',
    )
  })

  it('is the same function the main process re-exports', () => {
    expect(mainPlainMessage).toBe(plainMessage)
  })

  it('has a sentence for every kind in PROVIDER_ERROR_KINDS', () => {
    for (const kind of PROVIDER_ERROR_KINDS) {
      expect(plainMessage(kind, 'X')).toContain('X')
    }
  })
})
