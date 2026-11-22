// P7-13 (A-174): the sentence for runs a close leaves running, singular and plural.
import { describe, expect, it } from 'vitest'
import { leftRunningLine } from '@/renderer/ui/close-warning/close-words'

describe('leftRunningLine [P7-13, A-174]', () => {
  it.each([
    [
      1,
      'fal.ai Seedance has started 1 video and will charge for it. It keeps running; open the project again to collect it.',
    ],
    [
      3,
      'fal.ai Seedance has started 3 videos and will charge for them. They keep running; open the project again to collect them.',
    ],
  ])('for %i', (n, sentence) => {
    expect(leftRunningLine('fal.ai Seedance', n)).toBe(sentence)
  })
})
