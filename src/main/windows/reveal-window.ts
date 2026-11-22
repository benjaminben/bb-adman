// Shows the app window once, on whichever comes first: the page's first paint
// ('ready-to-show'), a page that did not load, or a few seconds. Waiting for 'ready-to-show'
// alone is not safe: when it never arrives the app runs with no window at all, which is what
// the installed app did on its first launch.
export const REVEAL_AFTER_MS = 4000

type Revealable = {
  once(event: 'ready-to-show', run: () => void): unknown
  isDestroyed(): boolean
  webContents: { once(event: 'did-fail-load', run: () => void): unknown }
}

export function revealOnce(
  win: Revealable,
  show: () => void,
  later: (run: () => void, ms: number) => unknown = setTimeout,
): void {
  let shown = false
  const reveal = () => {
    if (shown || win.isDestroyed()) return
    shown = true
    show()
  }
  win.once('ready-to-show', reveal)
  win.webContents.once('did-fail-load', reveal)
  later(reveal, REVEAL_AFTER_MS)
}
