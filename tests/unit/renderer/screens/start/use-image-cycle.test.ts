// START-1 (design/audit/spec-start.md "The crossfade"): the timer that changes the start
// picture, run on a fake clock.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import {
  useImageCycle,
  type CycleOptions,
} from '@/renderer/screens/start/start-images/use-image-cycle'

const ready = () => Promise.resolve()
let visibility: DocumentVisibilityState = 'visible'

function setVisibility(state: DocumentVisibilityState) {
  visibility = state
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'))
  })
}

async function wait(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

function start(count: number, options: CycleOptions = {}) {
  return renderHook(() =>
    useImageCycle(count, { preload: ready, reduceMotion: false, random: () => 0.5, ...options }),
  )
}

beforeEach(() => {
  vi.useFakeTimers()
  visibility = 'visible'
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility)
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('useImageCycle [START-1 The crossfade]', () => {
  it('shows the first picture at once, with no fade', () => {
    const { result } = start(10)
    expect(result.current).toEqual({ below: null, top: expect.any(Number), fading: false })
  })

  it('changes every 10 s with a 1.2 s fade, the new picture on top of the old', async () => {
    const { result } = start(10)
    const first = result.current.top
    await wait(9_999)
    expect(result.current.top).toBe(first)
    await wait(1)
    const second = result.current.top
    expect(result.current).toEqual({ below: first, top: second, fading: true })
    expect(second).not.toBe(first)
    await wait(1_199)
    expect(result.current.fading).toBe(true)
    await wait(1)
    expect(result.current).toEqual({ below: null, top: second, fading: false })
    await wait(8_800)
    expect(result.current.fading).toBe(true)
    expect(result.current.below).toBe(second)
  })

  it('shows all ten before a repeat, and never one twice in a row', async () => {
    let seed = 0
    const { result } = start(10, { random: () => (seed = (seed * 9301 + 49297) % 233280) / 233280 })
    const shown = [result.current.top]
    for (let i = 0; i < 29; i++) {
      await wait(10_000)
      shown.push(result.current.top)
    }
    for (const round of [0, 10, 20]) {
      expect(new Set(shown.slice(round, round + 10)).size).toBe(10)
    }
    expect(shown.filter((n, i) => i > 0 && shown[i - 1] === n)).toEqual([])
  })

  it('waits for the next picture to be ready rather than fade into a blank', async () => {
    let release = () => {}
    const slow = () => new Promise<void>((resolve) => (release = resolve))
    const { result } = start(10, { preload: slow })
    const first = result.current.top
    await wait(15_000)
    expect(result.current).toEqual({ below: null, top: first, fading: false })
    await act(async () => release())
    expect(result.current.fading).toBe(true)
    expect(result.current.below).toBe(first)
  })

  it('stops while the window is hidden; the next change is a full 10 s after it shows', async () => {
    const { result } = start(10)
    const first = result.current.top
    await wait(6_000)
    setVisibility('hidden')
    await wait(60_000)
    expect(result.current.top).toBe(first)
    setVisibility('visible')
    await wait(9_999)
    expect(result.current.top).toBe(first)
    await wait(1)
    expect(result.current.fading).toBe(true)
  })

  it('with reduce motion shows one picture and never changes it', async () => {
    const { result } = start(10, { reduceMotion: true })
    const first = result.current
    await wait(120_000)
    expect(result.current).toEqual(first)
    expect(first.top).not.toBeNull()
  })

  it('with no pictures shows none and sets no timer', async () => {
    const { result } = start(0)
    expect(result.current).toEqual({ below: null, top: null, fading: false })
    expect(vi.getTimerCount()).toBe(0)
  })

  it('clears its timer when the start screen goes away', () => {
    const { unmount } = start(10)
    expect(vi.getTimerCount()).toBeGreaterThan(0)
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
