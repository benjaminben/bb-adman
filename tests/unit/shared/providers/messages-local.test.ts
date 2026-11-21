// P4-5 (spec/ai-jobs.md "A plain sentence per failure cause", OI-68): each local reason's
// sentence with {provider} filled by fillMarks from the registry label.
import { describe, it, expect } from 'vitest'
import { fillMarks, reasonMessage } from '@/shared/providers/messages'
import type { ProviderErrorReason } from '@/shared/schemas/queries/app'

const FILLED: Array<[ProviderErrorReason, string]> = [
  [
    'key_missing',
    'Your Google Gemini key was removed after this run was queued. Add it in Settings, then try again.',
  ],
  [
    'picture_missing',
    'A picture this run uses can no longer be found. Find it again from the project page, then try again.',
  ],
  [
    'picture_too_large',
    'A picture this run uses is now larger than 32 MB. Choose a smaller picture, then try again.',
  ],
  [
    'picture_changed',
    'A picture this run uses has changed and can no longer be sent. Choose another picture, then try again.',
  ],
  [
    'assets_folder_missing',
    "The project's assets folder could not be found, so the results were not saved. Choose the assets folder again from the project page, then try again.",
  ],
  [
    'assets_not_writable',
    "The results could not be saved in the project's assets folder. Check that the folder can be written to, then try again.",
  ],
  ['results_not_added', 'The results were made but could not be added to the project. Try again.'],
  ['target_gone', 'The layer or variant this run was for has been deleted.'],
]

describe('local failure sentences with {provider} filled [OI-68, FR-069]', () => {
  it.each(FILLED)('%s reads its own sentence', (reason, expected) => {
    const text = fillMarks(reasonMessage(reason), { provider: 'Google Gemini' })
    expect(text).toBe(expected)
    expect(text).not.toMatch(/[{}]/)
  })

  it('reads "provider" when no label is given, so no mark is left', () => {
    expect(fillMarks(reasonMessage('key_missing'), {})).toBe(
      'Your provider key was removed after this run was queued. Add it in Settings, then try again.',
    )
  })
})
