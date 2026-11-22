import { describe, it, expect } from 'vitest'
import { jobWords } from '@/shared/comfy/workflow-words'

describe('the job words of a custom workflow [D-104]', () => {
  it.each([
    ['image', null, 0, 'Picture from a prompt'],
    ['image_refs', null, 1, 'Picture from a prompt and 1 reference picture'],
    ['image_refs', null, 3, 'Picture from a prompt and 3 reference pictures'],
    ['video', 'prompt', 0, 'Video from a prompt'],
    ['video', 'first_frame', 0, 'Video from a first frame'],
    ['video', 'references', 1, 'Video from 1 reference picture'],
    ['video', 'references', 2, 'Video from 2 reference pictures'],
  ] as const)('%s, start %s, %i pictures: %s', (job, start, n, words) => {
    expect(jobWords(job, start, n)).toBe(words)
  })
})
