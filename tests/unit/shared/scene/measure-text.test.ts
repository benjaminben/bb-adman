// LK-2: spec/scene.md "Settling and the overflow measurement", "With a text box". The text
// element is measured against the box's inner area, so measureOverflow catches text drawn
// past the top of a bottom-aligned box.
import { describe, expect, it } from 'vitest'
import { measuredText } from '@/shared/scene/measure-text'
import { measureOverflow } from '@/shared/scene/measure-overflow'

// clientHeight leaves out the outline (border) already, as the browser does.
const box = (clientHeight: number) => ({ clientHeight })
const text = (scrollWidth: number, scrollHeight: number, clientWidth = 300) => ({
  scrollWidth,
  scrollHeight,
  clientWidth,
})

describe('measuredText [LK-2]', () => {
  it('measures the text element against the box inner area', () => {
    expect(measuredText(box(100), text(280, 90), 0)).toEqual({
      scrollWidth: 280,
      scrollHeight: 90,
      clientWidth: 300,
      clientHeight: 100,
    })
  })

  it.each([
    { name: 'text that fits with no box values', box: 100, height: 100, padding: 0, want: false },
    { name: 'padding narrows the area', box: 100, height: 90, padding: 10, want: true },
    { name: 'text inside the padding', box: 100, height: 80, padding: 10, want: false },
    { name: 'an outline narrows the area', box: 100 - 2 * 4, height: 100, padding: 0, want: true },
    {
      name: 'bottom-aligned text taller than the box',
      box: 100,
      height: 160,
      padding: 0,
      want: true,
    },
  ])('$name: overflows $want', ({ box: inner, height, padding, want }) => {
    expect(measureOverflow(measuredText(box(inner), text(300, height), padding))).toBe(want)
  })

  it('catches a word longer than the box', () => {
    expect(measureOverflow(measuredText(box(100), text(420, 40, 300), 0))).toBe(true)
  })

  it('clamps the padding it subtracts to the look limits', () => {
    expect(measuredText(box(100), text(0, 0), -50).clientHeight).toBe(100)
    expect(measuredText(box(100), text(0, 0), Number.NaN).clientHeight).toBe(100)
  })
})
