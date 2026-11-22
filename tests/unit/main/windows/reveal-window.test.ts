// The app window is shown once, on whichever comes first: the page's first paint, a page that
// did not load, or a few seconds. A missing 'ready-to-show' must never leave the app running
// with no window.
import { describe, it, expect, vi } from 'vitest'
import { REVEAL_AFTER_MS, revealOnce } from '@/main/windows/reveal-window'

function fakeWindow() {
  const handlers = new Map<string, () => void>()
  let destroyed = false
  return {
    win: {
      once: (event: string, run: () => void) => handlers.set(event, run),
      isDestroyed: () => destroyed,
      webContents: { once: (event: string, run: () => void) => handlers.set(event, run) },
    },
    fire: (event: string) => handlers.get(event)?.(),
    destroy: () => {
      destroyed = true
    },
  }
}

function fakeTimer() {
  const waiting: Array<{ run: () => void; ms: number }> = []
  return {
    later: (run: () => void, ms: number) => waiting.push({ run, ms }),
    elapse: () => waiting.forEach((w) => w.run()),
    waiting,
  }
}

describe('revealOnce', () => {
  it.each(['ready-to-show', 'did-fail-load'])('shows the window on %s', (event) => {
    const { win, fire } = fakeWindow()
    const show = vi.fn()
    revealOnce(win, show, fakeTimer().later)
    expect(show).not.toHaveBeenCalled()
    fire(event)
    expect(show).toHaveBeenCalledTimes(1)
  })

  it('shows the window after the wait when no event ever arrives', () => {
    const { win } = fakeWindow()
    const timer = fakeTimer()
    const show = vi.fn()
    revealOnce(win, show, timer.later)
    expect(timer.waiting.map((w) => w.ms)).toEqual([REVEAL_AFTER_MS])
    expect(REVEAL_AFTER_MS).toBeLessThanOrEqual(5000)
    timer.elapse()
    expect(show).toHaveBeenCalledTimes(1)
  })

  it('shows the window only once, whatever arrives afterwards', () => {
    const { win, fire } = fakeWindow()
    const timer = fakeTimer()
    const show = vi.fn()
    revealOnce(win, show, timer.later)
    fire('ready-to-show')
    fire('did-fail-load')
    timer.elapse()
    expect(show).toHaveBeenCalledTimes(1)
  })

  it('does nothing for a window that is already gone', () => {
    const { win, destroy } = fakeWindow()
    const timer = fakeTimer()
    const show = vi.fn()
    revealOnce(win, show, timer.later)
    destroy()
    timer.elapse()
    expect(show).not.toHaveBeenCalled()
  })
})
