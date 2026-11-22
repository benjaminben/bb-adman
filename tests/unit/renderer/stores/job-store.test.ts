// A run's paid request count (SPEC 14 1.41 TP-2): the pictures a picture job asked for, or one
// submit for a video job.
import { describe, expect, it } from 'vitest'
import { requestCount } from '@/renderer/stores/job-store'
import { jobRow } from './job-fixture'

describe('requestCount', () => {
  it('gives the count of a picture job request, or null when it does not fit', () => {
    expect(requestCount(jobRow('J1'))).toBe(2)
    expect(requestCount(jobRow('J1', { request: { count: 'x' } }))).toBeNull()
  })
})

// P7-15b: a video retry is one paid submit, so its paid line states 1.
describe('requestCount for a video job', () => {
  it('gives 1 for a video_generation row', () => {
    expect(
      requestCount(jobRow('J1', { kind: 'video_generation', request: { prompt: 'A can' } })),
    ).toBe(1)
  })
})
