// ui/run-status/ (design wave CAMP-7: moved from the campaign page's run row): what a running
// job says. A picture run: the stage, the place in the queue and the percent (SPEC 6.11.1).
// A video run (SPEC 14 1.57 TP-6 "While it runs"): "Waiting (place n)" or "Working, m min"
// from the row's start time, with no percentage.
import { describe, expect, it } from 'vitest'
import { videoRunningText, workingDetail } from '@/renderer/ui/run-status'
import { jobRow } from '../stores/job-fixture'
import { videoRow } from '../screens/campaign/video-fixture'

const NOW = Date.parse('2026-11-21T00:10:00.000Z')
const minutesBefore = (m: number) => new Date(NOW - m * 60_000 - 5_000).toISOString()

describe('workingDetail [SPEC 6.11.1]', () => {
  it.each([
    [
      'the stage, the place in the queue and the percent',
      { stage: 'waiting', queuePosition: 3 },
      0.4,
      'waiting · place in queue 3 · 40%',
    ],
    ['the percent alone', null, 0.25, '25%'],
    ['nothing when the row holds nothing', null, null, ''],
    ['nothing of the wrong type', { stage: 4, queuePosition: 'x' }, null, ''],
  ])('gives %s', (_name, result, progress, text) => {
    expect(workingDetail(jobRow('J1', { status: 'running', result, progress }))).toBe(text)
  })
})

describe('videoRunningText [SPEC 14 1.57 TP-6]', () => {
  it.each([
    [
      '"Waiting (place n)" while the server holds it in its queue',
      { stage: 'waiting', queuePosition: 3 },
      'Waiting (place 3)',
    ],
    ['"Waiting" when the server gives no place', { stage: 'waiting' }, 'Waiting'],
    ['"Working, m min" from the start time', { stage: 'working' }, 'Working, 3 min'],
    ['"Working, m min" with no stage', {}, 'Working, 3 min'],
  ])('says %s', (_name, result, text) => {
    const row = videoRow({ status: 'running', progress: 0.4, createdAt: minutesBefore(3), result })
    expect(videoRunningText(row, NOW)).toBe(text)
  })

  it('says "Working, 0 min" for a start time it cannot read or one in the future', () => {
    expect(videoRunningText(videoRow({ status: 'running', createdAt: 'never' }), NOW)).toBe(
      'Working, 0 min',
    )
    expect(
      videoRunningText(videoRow({ status: 'running', createdAt: minutesBefore(-5) }), NOW),
    ).toBe('Working, 0 min')
  })
})
