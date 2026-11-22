// P7-18 (spec/phases/phase-07-slices-2.md): the playback of one video variant tab. The editor
// makes one per variant tab. It holds the time and whether it plays; one animation-frame loop
// runs while playing and stops at the variant's end. The clock is passed in for tests.
import { createStore, type StoreApi } from 'zustand/vanilla'

export type Clock = {
  now(): number // milliseconds
  frame(callback: () => void): number
  cancel(id: number): void
}

export type PlaybackState = {
  timeMs: number // whole milliseconds, 0 to durationMs
  playing: boolean
  durationMs: number
  play(): void
  pause(): void // also ends the loop when the tab closes
  toggle(): void
  scrub(timeMs: number): void
  setDuration(durationMs: number): void
}

export type PlaybackStore = StoreApi<PlaybackState>

const browserClock: Clock = {
  now: () => performance.now(),
  frame: (callback) => requestAnimationFrame(callback),
  cancel: (id) => cancelAnimationFrame(id),
}

const clamp = (ms: number, durationMs: number) => Math.min(Math.max(Math.round(ms), 0), durationMs)

export function createPlaybackStore(
  durationMs: number,
  clock: Clock = browserClock,
): PlaybackStore {
  let frameId: number | null = null
  // The clock reading and the time when play began or the playhead last moved by hand.
  let origin = { wall: 0, timeMs: 0 }

  return createStore<PlaybackState>((set, get) => {
    function endLoop() {
      if (frameId !== null) clock.cancel(frameId)
      frameId = null
    }

    function tick() {
      frameId = null
      const { durationMs: end, playing } = get()
      if (!playing) return
      const timeMs = origin.timeMs + clock.now() - origin.wall
      if (timeMs >= end) {
        set({ timeMs: end, playing: false })
        return
      }
      set({ timeMs: clamp(timeMs, end) })
      frameId = clock.frame(tick)
    }

    return {
      timeMs: 0,
      playing: false,
      durationMs,
      play() {
        if (get().playing) return
        const { timeMs, durationMs: end } = get()
        const from = timeMs >= end ? 0 : timeMs
        origin = { wall: clock.now(), timeMs: from }
        set({ timeMs: from, playing: true })
        frameId = clock.frame(tick)
      },
      pause() {
        endLoop()
        set({ playing: false })
      },
      toggle() {
        if (get().playing) get().pause()
        else get().play()
      },
      scrub(timeMs) {
        const next = clamp(timeMs, get().durationMs)
        origin = { wall: clock.now(), timeMs: next }
        set({ timeMs: next })
      },
      setDuration(next) {
        set({ durationMs: next, timeMs: Math.min(get().timeMs, next) })
      },
    }
  })
}

// The time the canvas draws: the playhead at the very end shows the last frame, not the black
// past it (a layer is drawn while t < its end).
export function sceneTime({ timeMs, durationMs }: Pick<PlaybackState, 'timeMs' | 'durationMs'>) {
  return Math.max(Math.min(timeMs, durationMs - 1), 0)
}

// m:ss.s, tenths rounded down, minutes not capped.
export function formatTime(ms: number): string {
  const tenths = Math.floor(ms / 100)
  const minutes = Math.floor(tenths / 600)
  const seconds = (tenths % 600) / 10
  return `${minutes}:${seconds.toFixed(1).padStart(4, '0')}`
}
