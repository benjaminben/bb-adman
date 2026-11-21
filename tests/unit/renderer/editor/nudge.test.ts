// spec/editor.md, "Moving, resizing and rotating", Nudge: arrows move 1 pixel, Shift and an
// arrow 10; presses are gathered and sent as one update 500 ms after the last press, or when
// the selection changes.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NUDGES, createNudgeBurst } from '@/renderer/editor/nudge'

describe('NUDGES', () => {
  it.each([
    ['nudgeLeft', { x: -1, y: 0 }],
    ['nudgeRight', { x: 1, y: 0 }],
    ['nudgeUp', { x: 0, y: -1 }],
    ['nudgeDown', { x: 0, y: 1 }],
    ['nudgeLeftFar', { x: -10, y: 0 }],
    ['nudgeRightFar', { x: 10, y: 0 }],
    ['nudgeUpFar', { x: 0, y: -10 }],
    ['nudgeDownFar', { x: 0, y: 10 }],
  ] as const)('%s moves by %o', (name, step) => {
    expect(NUDGES[name]).toEqual(step)
  })
})

describe('createNudgeBurst', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('a burst of presses gives one update, 500 ms after the last press', () => {
    const send = vi.fn()
    const burst = createNudgeBurst(send)
    const start = { x: 100, y: 50 }
    expect(burst.press('L1', start, { x: 1, y: 0 })).toEqual({ x: 101, y: 50 })
    for (let i = 0; i < 4; i += 1) {
      vi.advanceTimersByTime(400)
      burst.press('L1', start, { x: 0, y: 10 })
    }
    vi.advanceTimersByTime(499)
    expect(send).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(send.mock.calls).toEqual([['L1', { x: 101, y: 90 }]])
    expect(burst.pending()).toBeNull()
  })

  it('sends at once on flush (the selection changed), and not again later', () => {
    const send = vi.fn()
    const burst = createNudgeBurst(send)
    burst.press('L1', { x: 0, y: 0 }, { x: -1, y: 0 })
    expect(burst.pending()).toBe('L1')
    burst.flush()
    vi.advanceTimersByTime(1000)
    expect(send.mock.calls).toEqual([['L1', { x: -1, y: 0 }]])
  })

  it('a press on another layer sends the first layer’s burst', () => {
    const send = vi.fn()
    const burst = createNudgeBurst(send)
    burst.press('L1', { x: 0, y: 0 }, { x: 1, y: 0 })
    burst.press('L2', { x: 5, y: 5 }, { x: 0, y: 1 })
    expect(send.mock.calls).toEqual([['L1', { x: 1, y: 0 }]])
    vi.advanceTimersByTime(500)
    expect(send.mock.calls).toEqual([
      ['L1', { x: 1, y: 0 }],
      ['L2', { x: 5, y: 6 }],
    ])
  })

  it('a flush with nothing gathered sends nothing', () => {
    const send = vi.fn()
    createNudgeBurst(send).flush()
    expect(send).not.toHaveBeenCalled()
  })
})
