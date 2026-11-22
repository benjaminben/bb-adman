// spec/phases/round-2-approvals.md "Masonry (item 21)", case 2: where the browser has no CSS
// grid lanes, each card spans as many rows of --gallery-masonry-row as its height needs. The
// span goes through the element's style object only, again when a card changes size and when a
// picture loads. Once a card carries it, gallery-grid.module.css turns the rows on.

// The page's parts this module uses, by shape: the test project compiles this file without the
// browser's types.
type Query = { querySelectorAll<Found>(selectors: string): Iterable<Found> }
type Picture = {
  addEventListener(type: 'load', listener: () => void): void
  removeEventListener(type: 'load', listener: () => void): void
}
type Card = Query & {
  readonly style: { gridRowEnd: string }
  readonly parentElement: unknown
  getBoundingClientRect(): { height: number }
}
type Lightbox = { closest(selectors: 'article'): Card | null }
type Observer = { observe(target: Card): void; disconnect(): void }
export type MasonryPage = {
  document: Query
  CSS: { supports(property: string, value: string): boolean }
  getComputedStyle(element: unknown): { getPropertyValue(name: string): string; columnGap: string }
  ResizeObserver: new (changed: (entries: { target: unknown }[]) => void) => Observer
}

// Rows for a card of `height`, with the lane gap kept under it inside its span (the rows have
// no gap of their own), or null when a measure is not a usable length.
export function rowSpan(height: number, row: number, gap: number): number | null {
  if (![height, row, gap].every(Number.isFinite)) return null
  if (height < 0 || row <= 0 || gap < 0) return null
  return Math.max(1, Math.ceil((height + gap) / row))
}

export function startMasonrySpans(page: MasonryPage): () => void {
  if (page.CSS.supports('display', 'grid-lanes')) return () => {}
  const cards = [...page.document.querySelectorAll<Lightbox>('dialog[data-lightbox]')]
    .map((lightbox) => lightbox.closest('article'))
    .filter((card) => card !== null)
  const grid = cards[0]?.parentElement
  if (grid === null || grid === undefined) return () => {}

  const place = (card: Card) => {
    const style = page.getComputedStyle(grid)
    const row = Number.parseFloat(style.getPropertyValue('--gallery-masonry-row'))
    const gap = Number.parseFloat(style.columnGap)
    const span = rowSpan(card.getBoundingClientRect().height, row, gap)
    if (span !== null) card.style.gridRowEnd = `span ${span}`
  }

  const observer = new page.ResizeObserver((entries) => {
    for (const { target } of entries) {
      const card = cards.find((one) => one === target)
      if (card !== undefined) place(card)
    }
  })
  const loads = cards.map((card) => {
    const onLoad = () => place(card)
    const pictures = [...card.querySelectorAll<Picture>('img')]
    for (const picture of pictures) picture.addEventListener('load', onLoad)
    return () => {
      for (const picture of pictures) picture.removeEventListener('load', onLoad)
    }
  })
  for (const card of cards) {
    place(card)
    observer.observe(card)
  }

  return () => {
    observer.disconnect()
    for (const stop of loads) stop()
    for (const card of cards) card.style.gridRowEnd = ''
  }
}
