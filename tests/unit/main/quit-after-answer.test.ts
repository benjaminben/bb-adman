import { describe, it, expect } from 'vitest'
import { QUIT_BUTTON, quitQuestion, afterQuitAnswer } from '@/main/quit-question'

const CANCEL = quitQuestion(1)?.cancelId ?? -1

describe('what follows the answer to "Quit Adman?"', () => {
  it.each([
    [QUIT_BUTTON, true, 'quit'],
    [QUIT_BUTTON, false, 'quit'],
    [CANCEL, true, 'stay'],
    [CANCEL, false, 'showWindow'],
  ] as const)('answer %i with a live window %s gives %s', (response, live, want) => {
    expect(afterQuitAnswer(response, live)).toBe(want)
  })
})
