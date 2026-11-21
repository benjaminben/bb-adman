import { describe, it, expect } from 'vitest'
import {
  LOST_CONTACT_MS,
  MIN_TARGETED_INTERRUPT,
  PICTURE_WORK_MS,
  POLL_MS,
  QUEUE_WAIT_MS,
} from '../../../../../src/main/providers/comfyui/limits'

describe('the adapter limits CU-4 adds [SPEC 6.10.2, 6.10.14, 14 1.43 K-3]', () => {
  it('polls every 2 s and loses contact after 5 minutes of failed polls', () => {
    expect(POLL_MS).toBe(2_000)
    expect(LOST_CONTACT_MS).toBe(5 * 60_000)
  })

  it('waits up to 12 hours in the queue and 30 minutes working on a picture', () => {
    expect(QUEUE_WAIT_MS).toBe(12 * 60 * 60_000)
    expect(PICTURE_WORK_MS).toBe(30 * 60_000)
  })

  it('sends a targeted interrupt only from version 0.30.0', () => {
    expect(MIN_TARGETED_INTERRUPT).toBe('0.30.0')
  })
})
