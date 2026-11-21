import { describe, it, expect } from 'vitest'
import {
  COMFY_JOB_NOT_OFFERED_MESSAGE,
  tooManyReferencesMessage,
} from '@/shared/providers/messages'

describe('the ComfyUI refusal sentences [SPEC phase-02 F-14]', () => {
  it('says ComfyUI cannot make this kind of picture', () => {
    expect(COMFY_JOB_NOT_OFFERED_MESSAGE).toBe('ComfyUI cannot make this kind of picture yet.')
  })

  it('says "one reference picture" when the most is 1', () => {
    expect(tooManyReferencesMessage(1)).toBe('ComfyUI takes one reference picture for this run.')
  })

  it('says "at most {max} reference pictures" for any other most', () => {
    expect(tooManyReferencesMessage(3)).toBe(
      'ComfyUI takes at most 3 reference pictures for this run.',
    )
    expect(tooManyReferencesMessage(0)).toBe(
      'ComfyUI takes at most 0 reference pictures for this run.',
    )
  })
})
