// spec/phases/round-2-approvals.md "The lightbox (item 22)", keyboard: with script on, Right
// arrow or "Next" closes this lightbox and opens the next card's in gallery order, Left arrow or
// "Previous" the one before; nothing at either end. It touches only `hidden`, focus,
// `showModal()` and `close()`.

// The page's parts this module uses, by shape: the test project compiles this file without the
// browser's types.
type On<Type extends string, Event> = {
  addEventListener(type: Type, listener: (event: Event) => void): void
  removeEventListener(type: Type, listener: (event: Event) => void): void
}
type Query = { querySelectorAll<Found>(selectors: string): Iterable<Found> }
type Target = { closest?(selectors: string): unknown; isContentEditable?: boolean } | null
type Key = {
  key: string
  altKey: boolean
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
  target: Target
}
type Opener = { getAttribute(name: string): string | null; focus(): void }
type Lightbox = On<'close', unknown> & {
  readonly id: string
  readonly open: boolean
  showModal(): void
  close(): void
  closest(selectors: 'article'): Query | null
  contains(other: unknown): boolean
}
type Step = On<'click', unknown> & { hidden: boolean; readonly dataset: { step?: string } }
export type ArrowPage = { document: On<'keydown', Key> & Query }

const LIGHTBOX = 'dialog[data-lightbox]'

// The item one step from `current` in `order`, or null at either end, for a step that is not
// one card either way, or for an item not in the list.
export function stepFrom<T>(order: readonly T[], current: T, step: number): T | null {
  if (step !== 1 && step !== -1) return null
  const at = order.indexOf(current)
  if (at === -1) return null
  return order[at + step] ?? null
}

// A field keeps its own arrow keys.
const inField = (target: Target) =>
  target?.isContentEditable === true ||
  (target?.closest?.('input, textarea, select') ?? null) !== null

// The button on the card that opens this lightbox: the picture, the first in the card.
function openerOf(lightbox: Lightbox): Opener | null {
  const card = lightbox.closest('article')
  if (card === null) return null
  for (const button of card.querySelectorAll<Opener>('button[command="show-modal"]')) {
    if (!lightbox.contains(button) && button.getAttribute('commandfor') === lightbox.id) {
      return button
    }
  }
  return null
}

export function startArrowKeys({ document }: ArrowPage): () => void {
  const lightboxes = [...document.querySelectorAll<Lightbox>(LIGHTBOX)]
  const steps = [...document.querySelectorAll<Step>(`${LIGHTBOX} button[data-step]`)]
  for (const button of steps) button.hidden = false

  // Closing a lightbox reached by a step puts focus on its card's picture button; the browser
  // would put it on the button that opened the first one.
  const reached = new Set<Lightbox>()
  const move = (step: number) => {
    const current = lightboxes.find((lightbox) => lightbox.open)
    if (current === undefined) return
    const next = stepFrom(lightboxes, current, step)
    if (next === null) return
    reached.delete(current)
    current.close()
    next.showModal()
    reached.add(next)
  }

  const closes = lightboxes.map((lightbox) => {
    const onClose = () => {
      // A late close event from an earlier visit, after the lightbox was opened again.
      if (!reached.has(lightbox) || lightbox.open) return
      reached.delete(lightbox)
      openerOf(lightbox)?.focus()
    }
    lightbox.addEventListener('close', onClose)
    return () => lightbox.removeEventListener('close', onClose)
  })
  const clicks = steps.map((button) => {
    const onClick = () => move(Number(button.dataset.step))
    button.addEventListener('click', onClick)
    return () => button.removeEventListener('click', onClick)
  })
  const onKey = (event: Key) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
    if (inField(event.target)) return
    if (event.key === 'ArrowRight') move(1)
    else if (event.key === 'ArrowLeft') move(-1)
  }
  document.addEventListener('keydown', onKey)

  return () => {
    document.removeEventListener('keydown', onKey)
    for (const stop of [...closes, ...clicks]) stop()
    for (const button of steps) button.hidden = true
  }
}
