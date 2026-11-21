// P4-1 (spec/ai-jobs.md "A plain sentence per failure cause", OI-68): the eight local failure
// reasons and their sentences, beside the ComfyUI reasons.
import { describe, it, expect } from 'vitest'
import { reasonMessage } from '@/shared/providers/messages'
import { PROVIDER_ERROR_REASONS } from '@/shared/schemas/queries/app'

const LOCAL = [
  [
    'key_missing',
    'Your {provider} key was removed after this run was queued. Add it in Settings, then try again.',
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
] as const

describe('the local failure reasons [OI-68]', () => {
  it.each(LOCAL)('%s has its sentence', (reason, sentence) => {
    expect(PROVIDER_ERROR_REASONS).toContain(reason)
    expect(reasonMessage(reason)).toBe(sentence)
  })

  it('no sentence holds an address or a count mark', () => {
    for (const [reason] of LOCAL) expect(reasonMessage(reason)).not.toMatch(/\{address\}|\{n\}/)
  })
})
