import { describe, expect, it } from 'vitest'
import { stepFrom } from '../src/ui/gallery-script/arrow-keys'
import { commandAction } from '../src/ui/gallery-script/command-fallback'
import { rowSpan } from '../src/ui/gallery-script/masonry-spans'
import { clipParts } from '../src/ui/gallery-script/pause-videos'

// spec/phases/round-2-approvals.md R2A-8: the pure parts of the gallery script.

describe('the next and previous lightbox in gallery order', () => {
  const order = ['view-aaaa22', 'view-bbbb33', 'view-cccc44']
  it.each([
    ['view-aaaa22', 1, 'view-bbbb33'],
    ['view-bbbb33', 1, 'view-cccc44'],
    ['view-bbbb33', -1, 'view-aaaa22'],
    ['view-cccc44', -1, 'view-bbbb33'],
    // At either end nothing happens: no wrap.
    ['view-cccc44', 1, null],
    ['view-aaaa22', -1, null],
    // A step that is not one card either way, or a dialog not in the list, moves nowhere.
    ['view-aaaa22', 2, null],
    ['view-aaaa22', 0, null],
    ['view-bbbb33', Number.NaN, null],
    ['view-zzzz99', 1, null],
  ])('from %s by %d gives %s', (current, step, expected) => {
    expect(stepFrom(order, current, step)).toBe(expected)
  })

  it('moves nowhere in a gallery of one', () => {
    expect(stepFrom(['view-aaaa22'], 'view-aaaa22', 1)).toBeNull()
    expect(stepFrom(['view-aaaa22'], 'view-aaaa22', -1)).toBeNull()
  })
})

describe("the command buttons' fallback action", () => {
  it.each([
    ['show-modal', 'showModal'],
    ['close', 'close'],
    ['request-close', null],
    ['toggle-popover', null],
    ['SHOW-MODAL', null],
    ['', null],
    [null, null],
  ])('%s gives %s', (command, expected) => {
    expect(commandAction(command)).toBe(expected)
  })
})

describe('the masonry span from a card height', () => {
  // Rows of 4px with no row gap; the 16px lane gap is kept under each card inside its span.
  it.each([
    [100, 4, 16, 29],
    [104, 4, 16, 30],
    [0, 4, 16, 4],
    [300.5, 4, 16, 80],
    [1, 4, 0, 1],
  ])('a %dpx card in %dpx rows with a %dpx gap spans %d rows', (height, row, gap, span) => {
    expect(rowSpan(height, row, gap)).toBe(span)
  })

  it.each([
    [100, 0, 16],
    [100, -4, 16],
    [100, Number.NaN, 16],
    [Number.NaN, 4, 16],
    [100, 4, Number.NaN],
    [-10, 4, 16],
    [Number.POSITIVE_INFINITY, 4, 16],
  ])('gives no span for a %d card in %d rows with a %d gap', (height, row, gap) => {
    expect(rowSpan(height, row, gap)).toBeNull()
  })
})

// round-2-approvals-video.md "The gallery", the script (R2V-6): a lightbox's videos, the parts
// whose `error` event means the clip failed, and the failure notice.
describe("a lightbox's clip parts", () => {
  // A dialog stand-in that answers each selector from a table.
  const lightbox = (found: Record<string, string[]>) => ({
    querySelectorAll: <Found>(selectors: string) => (found[selectors] ?? []) as Found[],
  })

  it('finds the videos, their sources and the notice', () => {
    const parts = clipParts(
      lightbox({
        video: ['video-1'],
        'video source': ['source-1'],
        '[data-clip-error]': ['notice-1'],
      }),
    )
    expect(parts).toEqual({
      videos: ['video-1'],
      failing: ['video-1', 'source-1'],
      notice: 'notice-1',
    })
  })

  it('finds nothing in a lightbox for a picture', () => {
    expect(clipParts(lightbox({}))).toEqual({ videos: [], failing: [], notice: null })
  })

  it('keeps only the first notice', () => {
    const parts = clipParts(lightbox({ video: ['v'], '[data-clip-error]': ['first', 'second'] }))
    expect(parts.notice).toBe('first')
  })
})
