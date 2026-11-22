// P7-18 (spec/phases/phase-07-slices-2.md): one playback store per variant tab holds the time
// and whether it plays. One animation-frame loop runs while playing and stops at the end. The
// clock is passed in, so these tests move time by hand.
import { describe, expect, it } from 'vitest'
import {
  createPlaybackStore,
  formatTime,
  sceneTime,
  type Clock,
} from '@/renderer/stores/playback-store'

// A stand-in clock: frames run only when step() is called.
function standInClock() {
  let now = 0
  let next = 1
  const frames = new Map<number, () => void>()
  const clock: Clock = {
    now: () => now,
    frame(callback) {
      const id = next++
      frames.set(id, callback)
      return id
    },
    cancel(id) {
      frames.delete(id)
    },
  }
  function step(ms: number) {
    now += ms
    const due = [...frames.values()]
    frames.clear()
    for (const callback of due) callback()
  }
  return { clock, step, pending: () => frames.size }
}

function setUp(durationMs = 8000) {
  const c = standInClock()
  const store = createPlaybackStore(durationMs, c.clock)
  return { ...c, store, get: () => store.getState() }
}

describe('playback store [P7-18]', () => {
  it('starts at 0, paused, with no frame asked for', () => {
    const { get, pending } = setUp()
    expect(get()).toMatchObject({ timeMs: 0, playing: false, durationMs: 8000 })
    expect(pending()).toBe(0)
  })

  it('play advances the time with the clock', () => {
    const { get, step } = setUp()
    get().play()
    expect(get().playing).toBe(true)
    step(250)
    expect(get().timeMs).toBe(250)
    step(1000)
    expect(get().timeMs).toBe(1250)
  })

  it('pause holds the time and asks for no more frames', () => {
    const { get, step, pending } = setUp()
    get().play()
    step(400)
    get().pause()
    expect(pending()).toBe(0)
    step(1000)
    expect(get()).toMatchObject({ timeMs: 400, playing: false })
  })

  it('stops at the end, at the variant duration', () => {
    const { get, step, pending } = setUp(1000)
    get().play()
    step(600)
    step(600)
    expect(get()).toMatchObject({ timeMs: 1000, playing: false })
    expect(pending()).toBe(0)
  })

  it('play at the end starts again from 0', () => {
    const { get, step } = setUp(1000)
    get().scrub(1000)
    get().play()
    step(100)
    expect(get().timeMs).toBe(100)
  })

  it('scrub sets the time, whole milliseconds, kept inside 0 to the duration', () => {
    const { get } = setUp()
    get().scrub(1234.6)
    expect(get().timeMs).toBe(1235)
    get().scrub(-50)
    expect(get().timeMs).toBe(0)
    get().scrub(9000)
    expect(get().timeMs).toBe(8000)
  })

  it('scrub while playing goes on from the new time', () => {
    const { get, step } = setUp()
    get().play()
    step(500)
    get().scrub(4000)
    step(200)
    expect(get()).toMatchObject({ timeMs: 4200, playing: true })
  })

  it('toggle plays, then pauses', () => {
    const { get } = setUp()
    get().toggle()
    expect(get().playing).toBe(true)
    get().toggle()
    expect(get().playing).toBe(false)
  })

  it('a shorter duration pulls the time back inside it', () => {
    const { get } = setUp()
    get().scrub(6000)
    get().setDuration(5000)
    expect(get()).toMatchObject({ timeMs: 5000, durationMs: 5000 })
  })
})

describe('sceneTime: the time the canvas draws', () => {
  it.each([
    [0, 8000, 0],
    [4000, 8000, 4000],
    [8000, 8000, 7999],
    [0, 0, 0],
  ])('at %i of %i draws %i', (timeMs, durationMs, drawn) => {
    expect(sceneTime({ timeMs, durationMs })).toBe(drawn)
  })
})

describe('formatTime: m:ss.s', () => {
  it.each([
    [0, '0:00.0'],
    [8000, '0:08.0'],
    [65_432, '1:05.4'],
    [599_999, '9:59.9'],
    [86_400_000, '1440:00.0'],
  ])('%i ms reads %s', (ms, text) => {
    expect(formatTime(ms)).toBe(text)
  })
})
