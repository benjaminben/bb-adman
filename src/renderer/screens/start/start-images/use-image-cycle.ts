// The start picture's timer (design/audit/spec-start.md "The crossfade"). Every hold time a
// new picture fades in on top of the old one, which goes once the fade ends. The next one is
// loaded as soon as a fade ends, and a change waits for it. The timer stops while the window
// is hidden or the screen is gone; with reduce motion one picture shows and never changes.
import { useEffect, useState } from 'react'
import { shuffleOrder, type RandomSource } from './shuffle-order'

// Indexes into the picture list: the one underneath during a fade, and the one on top.
export type CycleView = { below: number | null; top: number | null; fading: boolean }

export type CycleOptions = {
  random?: RandomSource
  reduceMotion?: boolean
  // Loads and decodes picture `index`; resolves once it can be drawn.
  preload?: (index: number) => Promise<void>
}

const HOLD_MS = 10_000
const FADE_MS = 1_200

// A time token (--start-image-hold, --start-image-fade) in ms, or the fallback without one.
function tokenTime(name: string, fallback: number): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  const match = /^(\d*\.?\d+)(ms|s)$/.exec(raw)
  if (!match) return fallback
  return Number(match[1]) * (match[2] === 's' ? 1000 : 1)
}

export function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

type Run = {
  count: number
  order: number[]
  random: RandomSource
  preload: (index: number) => Promise<void>
  show: (view: CycleView) => void
}

// Runs the changes until the returned stop is called.
function runCycle(run: Run): () => void {
  const { count, random, preload, show } = run
  const hold = tokenTime('--start-image-hold', HOLD_MS)
  const fade = tokenTime('--start-image-fade', FADE_MS)
  let list = run.order
  let pos = 0
  let top = list[0] as number
  let next = top
  let nextReady = false
  let due = false
  let timer: ReturnType<typeof setTimeout> | undefined

  function loadNext() {
    pos += 1
    if (pos >= list.length) {
      list = shuffleOrder(count, random, top)
      pos = 0
    }
    const index = list[pos] as number
    next = index
    nextReady = false
    void preload(index)
      .catch(() => undefined)
      .then(() => {
        if (next !== index) return
        nextReady = true
        if (due) change()
      })
  }

  function change() {
    due = false
    const old = top
    top = next
    show({ below: old, top, fading: true })
    timer = setTimeout(() => {
      show({ below: null, top, fading: false })
      loadNext()
      timer = setTimeout(becomeDue, hold - fade)
    }, fade)
  }

  function becomeDue() {
    due = true
    if (nextReady) change()
  }

  // Hidden: a fade in progress ends at once, and nothing changes until the window shows.
  function onVisibility() {
    clearTimeout(timer)
    due = false
    if (document.visibilityState !== 'hidden') {
      timer = setTimeout(becomeDue, hold)
      return
    }
    show({ below: null, top, fading: false })
    if (next === top) loadNext()
  }

  loadNext()
  timer = setTimeout(becomeDue, hold)
  document.addEventListener('visibilitychange', onVisibility)
  return () => {
    clearTimeout(timer)
    due = false
    next = -1
    document.removeEventListener('visibilitychange', onVisibility)
  }
}

export function useImageCycle(count: number, options: CycleOptions = {}): CycleView {
  // The options are read once, when the screen first shows.
  const [settings] = useState(options)
  const [order] = useState(() => shuffleOrder(count, settings.random ?? Math.random))
  const [view, setView] = useState<CycleView>({
    below: null,
    top: count > 0 ? (order[0] as number) : null,
    fading: false,
  })

  useEffect(() => {
    const reduceMotion = settings.reduceMotion ?? prefersReducedMotion()
    if (count < 2 || reduceMotion) return
    return runCycle({
      count,
      order,
      random: settings.random ?? Math.random,
      preload: settings.preload ?? (() => Promise.resolve()),
      show: setView,
    })
  }, [count, order, settings])

  return view
}
