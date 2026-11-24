// D-110 (spec/approvals.md "An update in the background"): the bar's value is the share of the
// run's units that are finished, and there is no value when there is nothing to divide by.
import { describe, expect, it } from 'vitest'
import {
  progressValue,
  type UpdateProgress,
} from '@/renderer/dialogs/approval-dialog/use-update-progress'

const at = (unitsDone: number, unitsTotal: number): UpdateProgress => ({
  step: { step: 'drawing', done: 0, total: 1, unitsDone, unitsTotal },
  stopping: false,
  stop: () => undefined,
})

describe('progressValue', () => {
  it('is the share of units finished', () => {
    expect(progressValue(at(1, 4))).toBe(0.25)
    expect(progressValue(at(4, 4))).toBe(1)
  })

  it('is null before the first event and when the run has no units', () => {
    expect(progressValue({ ...at(0, 0), step: null })).toBeNull()
    expect(progressValue(at(0, 0))).toBeNull()
  })

  it('is null when an event holds no count of units', () => {
    const old = at(0, 0)
    old.step = { step: 'making', done: 0, total: 2 } as UpdateProgress['step']
    expect(progressValue(old)).toBeNull()
  })
})
